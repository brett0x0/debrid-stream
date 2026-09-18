import { MediaMetadata } from './types.js';

export interface CinemetaResponse {
  meta?: {
    id: string;
    type: string;
    name: string;
    year?: string | number;
    videos?: Array<{
      id: string;
      name?: string;
      title?: string;
      season: number;
      episode: number;
    }>;
  };
}

export class CinemetaClient {
  private baseUrl = 'https://v3-cinemeta.strem.io';

  /**
   * Resolves metadata for a movie or TV series episode from Stremio ID.
   * Format:
   * Movie: "tt0137523"
   * Series: "tt0903747:1:14" (ttId:season:episode)
   */
  public async resolve(type: 'movie' | 'series', id: string): Promise<MediaMetadata | null> {
    const parts = id.split(':');
    const imdbId = parts[0]!;
    const season = parts[1] ? parseInt(parts[1], 10) : undefined;
    const episode = parts[2] ? parseInt(parts[2], 10) : undefined;

    const url = `${this.baseUrl}/meta/${type}/${imdbId}.json`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as CinemetaResponse;
      if (!data.meta || !data.meta.name) {
        return null;
      }

      let episodeTitle: string | undefined;
      if (season !== undefined && episode !== undefined && data.meta.videos) {
        const ep = data.meta.videos.find((v) => v.season === season && v.episode === episode);
        if (ep) {
          episodeTitle = ep.title || ep.name;
        }
      }

      let year: number | undefined;
      if (data.meta.year) {
        const parsedYear = typeof data.meta.year === 'number' ? data.meta.year : parseInt(String(data.meta.year).substring(0, 4), 10);
        if (!isNaN(parsedYear)) {
          year = parsedYear;
        }
      }

      return {
        type,
        imdbId,
        title: data.meta.name,
        year,
        season,
        episode,
        episodeTitle,
      };
    } catch {
      return null;
    }
  }
}
