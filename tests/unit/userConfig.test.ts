import { describe, it, expect } from 'vitest';
import { userConfigSchema, encodeUserConfig, decodeUserConfig, maskToken, UserConfig } from '../../src/config/userConfig.js';

describe('UserConfig', () => {
  const sampleConfig: UserConfig = {
    rdToken: 'ABCDEF1234567890XYZ',
    maxResults: 25,
    maxResultsPerQuality: 2,
    preferredResolutions: ['2160p', '1080p'],
    preferredSources: ['REMUX', 'BluRay'],
    preferredCodecs: ['HEVC', 'AV1'],
    maxFileSizeGb: 20,
    excludedResolutions: [],
    enabledProviders: ['yts', 'eztv', '1337x', 'nyaasi', 'kickass', 'rarbg'],
    showCachedOnly: true,
    sortOrder: 'quality_seeders',
  };

  it('validates a correct configuration', () => {
    const parsed = userConfigSchema.parse(sampleConfig);
    expect(parsed.rdToken).toBe('ABCDEF1234567890XYZ');
    expect(parsed.maxResults).toBe(25);
    expect(parsed.maxResultsPerQuality).toBe(2);
    expect(parsed.sortOrder).toBe('quality_seeders');
  });

  it('rejects empty or missing rdToken', () => {
    expect(() => userConfigSchema.parse({ ...sampleConfig, rdToken: '' })).toThrow();
  });

  it('encrypts and decodes configuration successfully', () => {
    const encoded = encodeUserConfig(sampleConfig, true);
    expect(encoded).not.toContain('ABCDEF1234567890XYZ');
    const decoded = decodeUserConfig(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.rdToken).toBe(sampleConfig.rdToken);
    expect(decoded?.maxResults).toBe(25);
    expect(decoded?.maxResultsPerQuality).toBe(2);
    expect(decoded?.preferredResolutions).toEqual(['2160p', '1080p']);
    expect(decoded?.sortOrder).toBe('quality_seeders');
  });

  it('encodes and decodes in plain base64url when requested', () => {
    const encoded = encodeUserConfig(sampleConfig, false);
    const decoded = decodeUserConfig(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.rdToken).toBe(sampleConfig.rdToken);
  });

  it('returns null on invalid encoded string', () => {
    expect(decodeUserConfig('invalid-base-64-garbage!!')).toBeNull();
    expect(decodeUserConfig('')).toBeNull();
  });

  it('masks token correctly', () => {
    expect(maskToken('ABCDEF1234567890XYZ')).toBe('ABCD...0XYZ');
    expect(maskToken('short')).toBe('***');
    expect(maskToken('')).toBe('***');
  });
});
