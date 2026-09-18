import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { safeFetch } from '../httpClient.js';

interface EztvTorrent {
  id: number;
  hash: string;
  filename: string;
  episode: string;
  season: string;
  size_bytes: string | number;
  seeds: number;
  peers: number;
  magnet_url?: string;
}

interface EztvApiResponse {
  torrents_count: number;
  torrents?: EztvTorrent[];
}

export class EztvAdapter implements TorrentProvider {
  public readonly name = 'eztv';
  public readonly supportedTypes: ('movie' | 'series')[] = ['series'];
  private readonly baseUrl = 'https://eztv.re/api';

  public async searchMovie(_meta: MediaMetadata): Promise<TorrentCandidate[]> {
    return []; // EZTV does not index movies
  }

  public async searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];
    if (!meta.imdbId) return [];

    // Strip "tt" prefix for EZTV (e.g. "tt0903747" -> "0903747")
    const numericImdb = meta.imdbId.replace(/^tt/, '');

    try {
      const url = `${this.baseUrl}/get-torrents?imdb_id=${numericImdb}&limit=100`;
      const res = await safeFetch(url);
      if (!res.ok) return [];

      const data = (await res.json()) as EztvApiResponse;
      if (!data.torrents || !Array.isArray(data.torrents)) return [];

      for (const tor of data.torrents) {
        if (!tor.hash) continue;
        const cleanHash = tor.hash.toLowerCase();

        // If specific episode requested, verify filename contains SxxExx
        if (meta.season && meta.episode) {
          const sStr = String(meta.season).padStart(2, '0');
          const eStr = String(meta.episode).padStart(2, '0');
          const epPattern = new RegExp(`s${sStr}e${eStr}`, 'i');
          if (!epPattern.test(tor.filename)) {
            continue;
          }
        }

        const sizeBytes = typeof tor.size_bytes === 'number' ? tor.size_bytes : parseInt(String(tor.size_bytes), 10) || 0;

        candidates.push({
          id: `eztv-${cleanHash}`,
          provider: this.name,
          title: tor.filename,
          infoHash: cleanHash,
          sizeBytes,
          seeders: tor.seeds || 0,
          leechers: tor.peers || 0,
          magnetUri: tor.magnet_url || `magnet:?xt=urn:btih:${cleanHash}&dn=${encodeURIComponent(tor.filename)}`,
        });
      }
    } catch {
      return [];
    }

    return candidates;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const res = await safeFetch(`${this.baseUrl}/get-torrents?limit=1`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
