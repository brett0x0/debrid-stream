import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { MetadataNormalizer } from '../../metadata/normalizer.js';

export class RutrackerAdapter implements TorrentProvider {
  public readonly name = 'rutracker';
  public readonly displayName = 'Rutracker';
  public readonly category = 'regional';
  public readonly supportedTypes: ('movie' | 'series')[] = ['movie', 'series'];
  private readonly baseUrl = 'https://rutracker.org';

  public async searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchRutracker(queries[0]);
  }

  public async searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchRutracker(queries[0]);
  }

  private async searchRutracker(query: string): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];

    try {
      const url = `${this.baseUrl}/forum/tracker.php?nm=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!res.ok) return [];

      const html = await res.text();
      const magnetRegex = /href="(magnet:\?xt=urn:btih:([a-fA-F0-9]{40})[^"]*)"/gi;
      const titleRegex = /class="t-title">([^<]+)<\//gi;

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
          id: `rutracker-${item.hash}`,
          provider: this.name,
          title,
          infoHash: item.hash,
          sizeBytes: 0,
          seeders: 25,
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
      const res = await fetch(`${this.baseUrl}/`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
