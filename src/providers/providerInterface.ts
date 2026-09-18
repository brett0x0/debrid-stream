import { MediaMetadata } from '../metadata/types.js';
import { TorrentCandidate } from '../parser/types.js';

export type ProviderCategory = 'mainstream' | 'anime' | 'regional';

export interface TorrentProvider {
  readonly name: string;
  readonly displayName?: string;
  readonly category?: ProviderCategory;
  readonly supportedTypes: ('movie' | 'series')[];
  searchMovie(meta: MediaMetadata): Promise<TorrentCandidate[]>;
  searchSeries(meta: MediaMetadata): Promise<TorrentCandidate[]>;
  healthCheck(): Promise<boolean>;
}
