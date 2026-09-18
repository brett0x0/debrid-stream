import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { safeFetch } from '../httpClient.js';

export class TorrentGalaxyAdapter implements TorrentProvider {
  public readonly name = 'torrentgalaxy';
  public readonly supportedTypes: ('movie' | 'series')[] = ['movie', 'series'];
  private readonly baseUrl = 'https://torrentgalaxy.to';

  public async searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchTgx(queries[0]);
  }

  public async searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchTgx(queries[0]);
  }

  private async searchTgx(query: string): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];

    try {
      const url = `${this.baseUrl}/torrents.php?search=${encodeURIComponent(query)}&sort=seeders&order=desc`;
      const res = await safeFetch(url);

      if (!res.ok) return [];

      const html = await res.text();

      // Extract magnet links and titles from html
      // Magnet regex: magnet:\?xt=urn:btih:([a-zA-Z0-9]{40})
      const magnetRegex = /href="(magnet:\?xt=urn:btih:([a-zA-Z0-9]{40})[^"]*)"/g;
      const titleRegex = /title="([^"]+)"[^>]*class="txlight"/g;

      let match: RegExpExecArray | null;
      const magnets: { magnet: string; hash: string }[] = [];
      while ((match = magnetRegex.exec(html)) !== null) {
        if (match[1] && match[2]) {
          magnets.push({
            magnet: match[1],
            hash: match[2].toLowerCase(),
          });
        }
      }

      let titleMatch: RegExpExecArray | null;
      const titles: string[] = [];
      while ((titleMatch = titleRegex.exec(html)) !== null) {
        if (titleMatch[1]) {
          titles.push(titleMatch[1]);
        }
      }

      for (let i = 0; i < Math.min(magnets.length, titles.length); i++) {
        const item = magnets[i]!;
        const title = titles[i]!;

        candidates.push({
          id: `tgx-${item.hash}`,
          provider: this.name,
          title,
          infoHash: item.hash,
          sizeBytes: 0, // Fallback if size regex isn't matched
          seeders: 10,
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
      const res = await safeFetch(`${this.baseUrl}/`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
