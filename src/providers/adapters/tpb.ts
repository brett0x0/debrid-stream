import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { safeFetch } from '../httpClient.js';
import { logger } from '../../observability/logger.js';

interface TpbItem {
  id: string;
  name: string;
  info_hash: string;
  size: string;
  seeders: string;
  leechers: string;
  category: string;
}

export class ThePirateBayAdapter implements TorrentProvider {
  public readonly name = 'tpb';
  public readonly supportedTypes: ('movie' | 'series')[] = ['movie', 'series'];
  private readonly baseUrl = 'https://apibay.org';
  private readonly mirrorUrls = ['https://tpb.party', 'https://thepiratebay10.org'];

  public async searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    let results: TorrentCandidate[] = [];

    if (queries[0]) {
      results = await this.queryTpb(queries[0], '200');
    }

    if (results.length < 5 && meta.imdbId) {
      const imdbResults = await this.queryTpb(meta.imdbId, '200');
      results = [...results, ...imdbResults];
    }

    return results;
  }

  public async searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    let results: TorrentCandidate[] = [];

    // 1. Query episode release (e.g. "American Horror Story S03E03")
    if (queries[0]) {
      results = await this.queryTpb(queries[0], '200');
    }

    // 2. Also query season pack (e.g. "American Horror Story S03")
    if (queries[2]) {
      const packResults = await this.queryTpb(queries[2], '200');
      results = [...results, ...packResults];
    }

    if (results.length < 5 && meta.imdbId) {
      const imdbResults = await this.queryTpb(meta.imdbId, '200');
      results = [...results, ...imdbResults];
    }

    return results;
  }

  private async queryTpb(query: string, category: string): Promise<TorrentCandidate[]> {
    // 1. Try apibay.org first (fast JSON API for residential/unblocked environments)
    try {
      const candidates = await this.queryApibay(query, category);
      if (candidates.length > 0) {
        return candidates;
      }
    } catch {
      // Fall through to mirrors
    }

    // 2. Fall back to TPB web mirrors (unblocked in datacenter/cloud environments like Render)
    for (const mirror of this.mirrorUrls) {
      try {
        const candidates = await this.queryMirror(mirror, query, category);
        if (candidates.length > 0) {
          return candidates;
        }
      } catch (err: any) {
        logger.warn({ provider: this.name, mirror, query, err: err.message }, 'TPB mirror fetch failed');
      }
    }

    return [];
  }

  private async queryApibay(query: string, category: string): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];

    try {
      const url = `${this.baseUrl}/q.php?q=${encodeURIComponent(query)}&cat=${category}`;
      const res = await safeFetch(url);
      if (!res.ok) {
        return [];
      }

      const items = (await res.json()) as TpbItem[];
      if (!Array.isArray(items)) {
        return [];
      }

      for (const item of items) {
        if (!item.info_hash || item.id === '0' || item.name === 'No results returned') {
          continue;
        }

        const cleanHash = item.info_hash.toLowerCase();
        const sizeBytes = parseInt(item.size, 10) || 0;
        const seeders = parseInt(item.seeders, 10) || 0;
        const leechers = parseInt(item.leechers, 10) || 0;

        candidates.push({
          id: `tpb-${cleanHash}`,
          provider: this.name,
          title: item.name,
          infoHash: cleanHash,
          sizeBytes,
          seeders,
          leechers,
          magnetUri: `magnet:?xt=urn:btih:${cleanHash}&dn=${encodeURIComponent(item.name)}`,
        });
      }
    } catch {
      return [];
    }

    return candidates;
  }

  private async queryMirror(mirror: string, query: string, category: string): Promise<TorrentCandidate[]> {
    const url = `${mirror}/search/${encodeURIComponent(query)}/1/99/${category}`;
    const res = await safeFetch(url);
    if (!res.ok) {
      return [];
    }

    const html = await res.text();
    const candidates: TorrentCandidate[] = [];

    const rowRegex = /<tr[^>]*>[\s\S]*?title="Details for ([^"]+)"[\s\S]*?href="(magnet:\?xt=urn:btih:([a-fA-F0-9]{40})[^"]*)"[\s\S]*?<td align="right">([0-9\.]+)(?:&nbsp;|\s*)([KMGTP]?i?B)<\/td>[\s\S]*?<td align="right">([0-9]+)<\/td>[\s\S]*?<td align="right">([0-9]+)<\/td>[\s\S]*?<\/tr>/gi;

    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(html)) !== null) {
      const title = match[1]!;
      const magnet = match[2]!;
      const cleanHash = match[3]!.toLowerCase();
      const sizeVal = parseFloat(match[4]!);
      const sizeUnit = match[5]!.toUpperCase();
      const seeders = parseInt(match[6]!, 10) || 0;
      const leechers = parseInt(match[7]!, 10) || 0;

      let multiplier = 1;
      if (sizeUnit.includes('K')) multiplier = 1024;
      else if (sizeUnit.includes('M')) multiplier = 1024 * 1024;
      else if (sizeUnit.includes('G')) multiplier = 1024 * 1024 * 1024;
      else if (sizeUnit.includes('T')) multiplier = 1024 * 1024 * 1024 * 1024;

      const sizeBytes = Math.round(sizeVal * multiplier);

      candidates.push({
        id: `tpb-${cleanHash}`,
        provider: this.name,
        title,
        infoHash: cleanHash,
        sizeBytes,
        seeders,
        leechers,
        magnetUri: magnet,
      });
    }

    return candidates;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const res = await safeFetch(`${this.baseUrl}/q.php?q=test&cat=200`);
      if (res.ok) return true;
      const mirrorRes = await safeFetch(`${this.mirrorUrls[0]}/search/test/1/99/200`);
      return mirrorRes.ok;
    } catch {
      return false;
    }
  }
}
