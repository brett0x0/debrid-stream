import { TorrentProvider } from '../providerInterface.js';
import { MediaMetadata } from '../../metadata/types.js';
import { TorrentCandidate } from '../../parser/types.js';
import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { safeFetch } from '../httpClient.js';

export class MagnetDlAdapter implements TorrentProvider {
  public readonly name = 'magnetdl';
  public readonly displayName = 'MagnetDL';
  public readonly category = 'mainstream';
  public readonly supportedTypes: ('movie' | 'series')[] = ['movie', 'series'];
  private readonly baseUrl = 'https://www.magnetdl.com';

  public async searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchMagnetDl(queries[0]);
  }

  public async searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]> {
    const queries = MetadataNormalizer.buildSearchQueries(meta);
    if (!queries[0]) return [];
    return this.searchMagnetDl(queries[0]);
  }

  private async searchMagnetDl(query: string): Promise<TorrentCandidate[]> {
    const candidates: TorrentCandidate[] = [];

    try {
      const clean = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (!clean) return [];

      const firstChar = clean[0]!;
      const slug = clean.split(/\s+/).join('-');
      const url = `${this.baseUrl}/${firstChar}/${slug}/`;

      const res = await safeFetch(url);

      if (!res.ok) return [];
      const html = await res.text();

      // Find table rows with magnets
      const magnetRegex = /href="(magnet:\?xt=urn:btih:([a-fA-F0-9]{40})[^"]*)"\s+title="([^"]*)"/gi;
      let match: RegExpExecArray | null;

      while ((match = magnetRegex.exec(html)) !== null) {
        const magnetUri = match[1]!;
        const hash = match[2]!.toLowerCase();
        const title = match[3] || 'Torrent';

        candidates.push({
          id: `magnetdl-${hash}`,
          provider: this.name,
          title,
          infoHash: hash,
          sizeBytes: 0,
          seeders: 10,
          magnetUri,
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
