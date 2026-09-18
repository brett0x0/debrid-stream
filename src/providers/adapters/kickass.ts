import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { MetadataNormalizer } from '../../metadata/normalizer.js';

export class KickassAdapter implements TorrentProvider {
  public readonly name = 'kickass';
  public readonly displayName = 'KickassTorrents';
  public readonly category = 'mainstream';
  public readonly supportedTypes: ('movie' | 'series')[] = ['movie', 'series'];
  private readonly baseUrl = 'https://kickasstorrents.to';

  public async searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchKat(queries[0]);
  }

  public async searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchKat(queries[0]);
  }

  private async searchKat(query: string): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];

    try {
      const url = `${this.baseUrl}/usearch/${encodeURIComponent(query)}/`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });

      if (!res.ok) return [];
      const html = await res.text();

      // Extract magnet links and torrent titles
      const magnetRegex = /href="(magnet:\?xt=urn:btih:([a-fA-F0-9]{40})[^"]*)"/g;
      const titleRegex = /class="cellMainLink">([^<]+)<\/a>/g;

      const magnets: { magnet: string; hash: string }[] = [];
      let mMatch: RegExpExecArray | null;
      while ((mMatch = magnetRegex.exec(html)) !== null) {
        if (mMatch[1] && mMatch[2]) {
          magnets.push({ magnet: mMatch[1], hash: mMatch[2].toLowerCase() });
        }
      }

      const titles: string[] = [];
      let tMatch: RegExpExecArray | null;
      while ((tMatch = titleRegex.exec(html)) !== null) {
        if (tMatch[1]) {
          titles.push(tMatch[1].trim());
        }
      }

      for (let i = 0; i < Math.min(magnets.length, titles.length); i++) {
        const item = magnets[i]!;
        const title = titles[i]!;

        candidates.push({
          id: `kat-${item.hash}`,
          provider: this.name,
          title,
          infoHash: item.hash,
          sizeBytes: 0,
          seeders: 15,
          magnetUri: item.magnet,
        });
      }
    } catch {
      return [];
    }

    return candidates;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
