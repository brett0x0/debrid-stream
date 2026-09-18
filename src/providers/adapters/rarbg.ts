import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { MetadataNormalizer } from '../../metadata/normalizer.js';

export class RarbgAdapter implements TorrentProvider {
  public readonly name = 'rarbg';
  public readonly displayName = 'RARBG';
  public readonly category = 'mainstream';
  public readonly supportedTypes: ('movie' | 'series')[] = ['movie', 'series'];
  private readonly baseUrl = 'https://torrentapi.org/pubapi_v2.php';
  private token: string | null = null;
  private tokenTime = 0;

  public async searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    if (meta.imdbId) {
      return this.queryApi({ mode: 'search', search_imdb: meta.imdbId, category: 'movies' });
    }
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.queryApi({ mode: 'search', search_string: queries[0], category: 'movies' });
  }

  public async searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    if (meta.imdbId && meta.season !== undefined && meta.episode !== undefined) {
      const s = String(meta.season).padStart(2, '0');
      const e = String(meta.episode).padStart(2, '0');
      return this.queryApi({ mode: 'search', search_imdb: meta.imdbId, search_string: `S${s}E${e}`, category: 'tv' });
    }
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.queryApi({ mode: 'search', search_string: queries[0], category: 'tv' });
  }

  private async getToken(): Promise<string | null> {
    if (this.token && Date.now() - this.tokenTime < 1000 * 60 * 10) {
      return this.token;
    }

    try {
      const res = await fetch(`${this.baseUrl}?get_token=get_token&app_id=debridstream`);
      if (!res.ok) return null;
      const data = (await res.json()) as { token?: string };
      if (data && data.token) {
        this.token = data.token;
        this.tokenTime = Date.now();
        return this.token;
      }
    } catch {
      return null;
    }
    return null;
  }

  private async queryApi(params: Record<string, string>): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];

    try {
      const token = await this.getToken();
      if (!token) return [];

      const queryParams = new URLSearchParams({
        ...params,
        token,
        app_id: 'debridstream',
        format: 'json_extended',
        limit: '50',
      });

      const res = await fetch(`${this.baseUrl}?${queryParams.toString()}`);
      if (!res.ok) return [];

      const data = (await res.json()) as { torrent_results?: Array<{ title: string; download: string; seeders: number; leechers: number; size: number }> };
      if (!data.torrent_results || !Array.isArray(data.torrent_results)) return [];

      for (const item of data.torrent_results) {
        if (!item.download) continue;
        const hashMatch = item.download.match(/urn:btih:([a-fA-F0-9]{40})/i);
        if (!hashMatch || !hashMatch[1]) continue;

        const cleanHash = hashMatch[1].toLowerCase();
        candidates.push({
          id: `rarbg-${cleanHash}`,
          provider: this.name,
          title: item.title,
          infoHash: cleanHash,
          sizeBytes: item.size || 0,
          seeders: item.seeders || 0,
          leechers: item.leechers || 0,
          magnetUri: item.download,
        });
      }
    } catch {
      return [];
    }

    return candidates;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const token = await this.getToken();
      return !!token;
    } catch {
      return false;
    }
  }
}
