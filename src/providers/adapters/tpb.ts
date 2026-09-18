import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { safeFetch } from '../httpClient.js';

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

  public async searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];

    // Search for all video (SD, HD, 4K, Remux)
    return this.queryApibay(queries[0], '200');
  }

  public async searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];

    // Search for all video (SD, HD, 4K)
    return this.queryApibay(queries[0], '200');
  }

  private async queryApibay(query: string, category: string): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];

    try {
      const url = `${this.baseUrl}/q.php?q=${encodeURIComponent(query)}&cat=${category}`;
      const res = await safeFetch(url);
      if (!res.ok) return [];

      const items = (await res.json()) as TpbItem[];
      if (!Array.isArray(items)) return [];

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

  public async healthCheck(): Promise<boolean> {
    try {
      const res = await safeFetch(`${this.baseUrl}/q.php?q=test&cat=200`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
