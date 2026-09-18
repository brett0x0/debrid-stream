import { Resolution, QualitySource, VideoCodec } from '../config/userConfig.js';

export interface AudioInfo {
  codec: string; // 'Atmos', 'TrueHD', 'DTS-HD MA', 'DTS', 'EAC3', 'AC3', 'AAC', 'MP3', 'Unknown'
  channels: string; // '7.1', '5.1', '2.0', 'Unknown'
}

export interface HdrInfo {
  hdr: boolean;
  hdr10: boolean;
  hdr10plus: boolean;
  dolbyVision: boolean;
}

export interface ParsedRelease {
  rawTitle: string;
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  episodes?: number[]; // For multi-episode files like S01E01-E03
  isCompleteSeason?: boolean;
  resolution: Resolution;
  source: QualitySource;
  codec: VideoCodec;
  audio: AudioInfo;
  hdr: HdrInfo;
  bitDepth?: number; // 10, 8
  releaseGroup?: string;
  container?: string;
  proper: boolean;
  repack: boolean;
  remastered: boolean;
}

export interface TorrentCandidate {
  id: string; // Unique internal candidate ID or infoHash
  provider: string; // Provider name (e.g. 'yts', 'eztv', 'tpb')
  title: string; // Raw torrent title / filename
  infoHash: string; // 40-char hex infohash (lowercase)
  magnetUri?: string;
  sizeBytes: number;
  seeders: number;
  leechers?: number;
  fileIdx?: number; // Target video file index if known
  filename?: string;
  parsed?: ParsedRelease;
}
