import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { safeFetch } from '../httpClient.js';

interface YtsTorrent {
  url: string;
  hash: string;
  quality: string;
  type: string;
  seeds: number;
  peers: number;
  size_bytes: number;
}

interface YtsMovie {
  title: string;
  year: number;
  torrents?: YtsTorrent[];
}

interface YtsApiResponse {
  status: string;
  data?: {
    movie_count: number;
    movies?: YtsMovie[];
  };
}

export class YtsAdapter implements TorrentProvider {
  public readonly name = 'yts';
  public readonly supportedTypes: ('movie' | 'series')[] = ['movie'];
  private readonly baseUrl = 'https://yts.mx/api/v2';

  public async searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];
    const query = meta.imdbId || meta.title;

    try {
      const url = `${this.baseUrl}/list_movies.json?query_term=${encodeURIComponent(query)}`;
      const res = await safeFetch(url);
      if (!res.ok) return [];

      const data = (await res.json()) as YtsApiResponse;
      if (!data.data || !data.data.movies) return [];

      for (const movie of data.data.movies) {
        if (!movie.torrents) continue;

        for (const tor of movie.torrents) {
          if (!tor.hash) continue;
          const cleanHash = tor.hash.toLowerCase();
          const title = `${movie.title} (${movie.year}) [${tor.quality}] [${tor.type.toUpperCase()}] [YTS]`;

          candidates.push({
            id: `yts-${cleanHash}`,
            provider: this.name,
            title,
            infoHash: cleanHash,
            sizeBytes: tor.size_bytes || 0,
            seeders: tor.seeds || 0,
            leechers: tor.peers || 0,
            magnetUri: `magnet:?xt=urn:btih:${cleanHash}&dn=${encodeURIComponent(title)}`,
          });
        }
      }
    } catch {
      return [];
    }

    return candidates;
  }

  public async searchSeries(_meta: MediaMetadata): Promise<TorrentCandidate[]> {
    return []; // YTS does not index series
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const res = await safeFetch(`${this.baseUrl}/list_movies.json?limit=1`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
