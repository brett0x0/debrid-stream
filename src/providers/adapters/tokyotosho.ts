import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { RssHelper } from '../rssHelper.js';

export class TokyoToshoAdapter implements TorrentProvider {
  public readonly name = 'tokyotosho';
  public readonly displayName = 'TokyoTosho';
  public readonly category = 'anime';
  public readonly supportedTypes: ('movie' | 'series')[] = ['movie', 'series'];
  private readonly baseUrl = 'https://tokyotosho.info';

  public async searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchTokyo(queries[0]);
  }

  public async searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchTokyo(queries[0]);
  }

  private async searchTokyo(query: string): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];

    try {
      const url = `${this.baseUrl}/rss.php?terms=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) return [];

      const xml = await res.text();
      const items = RssHelper.parseItems(xml);

      for (const item of items) {
        if (!item.infoHash || item.infoHash.length !== 40) continue;

        candidates.push({
          id: `tokyo-${item.infoHash}`,
          provider: this.name,
          title: item.title,
          infoHash: item.infoHash,
          sizeBytes: item.sizeBytes,
          seeders: item.seeders || 5,
          leechers: item.leechers,
          magnetUri: item.magnetUri,
        });
      }
    } catch {
      return [];
    }

    return candidates;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/rss.php`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
