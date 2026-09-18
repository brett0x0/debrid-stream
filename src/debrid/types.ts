export interface RdUser {
  id: number;
  username: string;
  email: string;
  points: number;
  type: 'premium' | 'free';
  expiration: string;
}

export interface RdInstantFile {
  filename: string;
  filesize: number;
}

export interface RdInstantVariant {
  [fileId: string]: RdInstantFile;
}

export interface RdInstantHoster {
  rd?: RdInstantVariant[];
}

export interface RdInstantAvailabilityResponse {
  [infoHash: string]: RdInstantHoster;
}

export interface RdAddMagnetResponse {
  id: string;
  uri: string;
}

export interface RdTorrentFile {
  id: number;
  path: string;
  bytes: number;
  selected: number;
}

export interface RdTorrentInfo {
  id: string;
  filename: string;
  original_filename?: string;
  hash: string;
  bytes: number;
  progress: number;
  status:
    | 'magnet_conversion'
    | 'waiting_files_selection'
    | 'queued'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'virus'
    | 'compressing'
    | 'uploading'
    | 'dead';
  statusCode: number;
  links: string[];
  files: RdTorrentFile[];
}

export interface RdUnrestrictResponse {
  id: string;
  filename: string;
  mimeType?: string;
  filesize?: number;
  link: string;
  host: string;
  download: string;
  streamable?: number;
}
