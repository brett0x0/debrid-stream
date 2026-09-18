import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { RssHelper } from '../rssHelper.js';

export class NyaaAdapter implements TorrentProvider {
  public readonly name = 'nyaasi';
  public readonly displayName = 'NyaaSi';
  public readonly category = 'anime';
  public readonly supportedTypes: ('movie' | 'series')[] = ['movie', 'series'];
  private readonly baseUrl = 'https://nyaa.si';

  public async searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchNyaa(queries[0]);
  }

  public async searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchNyaa(queries[0]);
  }

  private async searchNyaa(query: string): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];

    try {
      const url = `${this.baseUrl}/?page=rss&q=${encodeURIComponent(query)}&c=0_0&f=0`;
      const res = await fetch(url);
      if (!res.ok) return [];

      const xml = await res.text();
      const items = RssHelper.parseItems(xml);

      for (const item of items) {
        if (!item.infoHash || item.infoHash.length !== 40) continue;

        candidates.push({
          id: `nyaa-${item.infoHash}`,
          provider: this.name,
          title: item.title,
          infoHash: item.infoHash,
          sizeBytes: item.sizeBytes,
          seeders: item.seeders,
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
      const res = await fetch(`${this.baseUrl}/?page=rss&limit=1`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
