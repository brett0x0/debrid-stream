export interface MediaMetadata {
  type: 'movie' | 'series';
  imdbId: string;
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  episodeTitle?: string;
  aliases?: string[];
}
