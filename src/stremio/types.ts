export interface StremioBehaviorHints {
  configurable?: boolean;
  configurationRequired?: boolean;
  bingeGroup?: string;
  notWebReady?: boolean;
}

export interface StremioManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  resources: ('stream' | 'meta' | 'catalog' | 'subtitles')[];
  types: ('movie' | 'series' | 'anime')[];
  idPrefixes?: string[];
  catalogs: any[];
  behaviorHints?: StremioBehaviorHints;
}

export interface StremioStream {
  name: string;
  title: string;
  url: string;
  behaviorHints?: StremioBehaviorHints;
}

export interface StremioStreamResponse {
  streams: StremioStream[];
}
