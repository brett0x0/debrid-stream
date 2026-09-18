import { z } from 'zod';
import crypto from 'crypto';
import { env } from './env.js';

export const ResolutionSchema = z.enum(['2160p', '1080p', '720p', '480p', 'unknown']);
export type Resolution = z.infer<typeof ResolutionSchema>;

export const QualitySourceSchema = z.enum(['REMUX', 'BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'CAM', 'unknown']);
export type QualitySource = z.infer<typeof QualitySourceSchema>;

export const VideoCodecSchema = z.enum(['AV1', 'HEVC', 'AVC', 'XVID', 'unknown']);
export type VideoCodec = z.infer<typeof VideoCodecSchema>;

export const ALL_PROVIDERS = [
  'yts',
  'eztv',
  'rarbg',
  '1337x',
  'tpb',
  'kickass',
  'torrentgalaxy',
  'magnetdl',
  'nyaasi',
  'tokyotosho',
  'anidex',
  'rutor',
  'rutracker',
  'torrent9',
  'mejortorrent',
  'cinecalidad',
] as const;

export const userConfigSchema = z.object({
  rdToken: z.string().min(1, 'Real-Debrid API token is required').trim(),
  maxResults: z.coerce.number().min(1).max(200).default(30),
  maxResultsPerQuality: z.coerce.number().min(0).max(50).default(0), // 0 = All results
  preferredResolutions: z.array(ResolutionSchema).default(['2160p', '1080p', '720p']),
  preferredSources: z.array(QualitySourceSchema).default(['REMUX', 'BluRay', 'WEB-DL', 'WEBRip']),
  preferredCodecs: z.array(VideoCodecSchema).default(['HEVC', 'AVC', 'AV1']),
  maxFileSizeGb: z.coerce.number().min(0).default(0), // 0 = no limit
  excludedResolutions: z.array(ResolutionSchema).default([]),
  enabledProviders: z.array(z.string()).default([...ALL_PROVIDERS]),
  showCachedOnly: z.boolean().default(true),
  sortOrder: z
    .enum(['quality_seeders', 'quality_size', 'seeders', 'size', 'quality'])
    .default('quality_seeders')
    .transform((val) => (val === 'quality' ? 'quality_seeders' : val)),
});

export type UserConfig = z.infer<typeof userConfigSchema>;

/**
 * Derives a 32-byte encryption key from the app SECRET_KEY.
 */
function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(env.SECRET_KEY).digest();
}

/**
 * Encrypts and encodes a UserConfig object into a URL-safe string.
 */
export function encodeUserConfig(config: UserConfig, encrypt: boolean = true): string {
  const jsonStr = JSON.stringify(config);

  if (!encrypt) {
    return Buffer.from(jsonStr, 'utf-8').toString('base64url');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Payload structure: [1 byte version (1)][12 bytes IV][16 bytes Tag][Ciphertext]
  const payload = Buffer.concat([Buffer.from([1]), iv, tag, encrypted]);
  return payload.toString('base64url');
}

/**
 * Decodes and decrypts a config string back into a validated UserConfig.
 * Supports both encrypted payload and plaintext base64url JSON.
 */
export function decodeUserConfig(encoded: string): UserConfig | null {
  try {
    const rawBuf = Buffer.from(encoded, 'base64url');

    if (rawBuf.length >= 29 && rawBuf[0] === 1) {
      try {
        const iv = rawBuf.subarray(1, 13);
        const tag = rawBuf.subarray(13, 29);
        const ciphertext = rawBuf.subarray(29);

        const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
        const parsed = JSON.parse(decrypted);
        return userConfigSchema.parse(parsed);
      } catch {
        // Fallback to plain JSON
      }
    }

    const jsonStr = rawBuf.toString('utf8');
    const parsed = JSON.parse(jsonStr);
    return userConfigSchema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Masks a sensitive token for safe logging/display (e.g. "abc...xyz")
 */
export function maskToken(token: string): string {
  if (!token) return '***';
  if (token.length <= 8) return '***';
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}
