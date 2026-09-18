import { describe, it, expect } from 'vitest';
import { StreamRanker } from '../../src/ranking/ranker.js';
import { TorrentCandidate } from '../../src/parser/types.js';
import { ReleaseParser } from '../../src/parser/releaseParser.js';
import { UserConfig } from '../../src/config/userConfig.js';

describe('StreamRanker', () => {
  const baseConfig: UserConfig = {
    rdToken: 'test-token',
    maxResults: 10,
    maxResultsPerQuality: 0,
    preferredResolutions: ['2160p', '1080p', '720p'],
    preferredSources: ['REMUX', 'BluRay', 'WEB-DL'],
    preferredCodecs: ['HEVC', 'AVC'],
    maxFileSizeGb: 0,
    excludedResolutions: [],
    enabledProviders: ['yts', 'tpb'],
    showCachedOnly: false,
    sortOrder: 'quality_seeders',
  };

  const cand4kRemux: TorrentCandidate = {
    id: '1',
    provider: 'tpb',
    title: 'Fight.Club.1999.2160p.UHD.Remux.HEVC-FLUX',
    infoHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    sizeBytes: 45000000000,
    seeders: 50,
    parsed: ReleaseParser.parse('Fight.Club.1999.2160p.UHD.Remux.HEVC-FLUX'),
  };

  const cand4kWeb: TorrentCandidate = {
    id: '4',
    provider: 'tpb',
    title: 'Fight.Club.1999.2160p.WEB-DL.HEVC-GROUP',
    infoHash: 'dddddddddddddddddddddddddddddddddddddddd',
    sizeBytes: 15000000000,
    seeders: 20,
    parsed: ReleaseParser.parse('Fight.Club.1999.2160p.WEB-DL.HEVC-GROUP'),
  };

  const cand1080pBluRay: TorrentCandidate = {
    id: '2',
    provider: 'tpb',
    title: 'Fight.Club.1999.1080p.BluRay.x264-SPARKS',
    infoHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    sizeBytes: 10000000000,
    seeders: 120,
    parsed: ReleaseParser.parse('Fight.Club.1999.1080p.BluRay.x264-SPARKS'),
  };

  const cand720pWeb: TorrentCandidate = {
    id: '3',
    provider: 'tpb',
    title: 'Fight.Club.1999.720p.WEB-DL.AAC-GROUP',
    infoHash: 'cccccccccccccccccccccccccccccccccccccccc',
    sizeBytes: 2000000000,
    seeders: 30,
    parsed: ReleaseParser.parse('Fight.Club.1999.720p.WEB-DL.AAC-GROUP'),
  };

  it('ranks 4K Remux higher when 2160p is top preference and both are cached', () => {
    const cached = new Set([cand4kRemux.infoHash, cand1080pBluRay.infoHash]);
    const ranked = StreamRanker.rank([cand1080pBluRay, cand4kRemux], cached, baseConfig);

    expect(ranked[0]?.candidate.infoHash).toBe(cand4kRemux.infoHash);
    expect(ranked[1]?.candidate.infoHash).toBe(cand1080pBluRay.infoHash);
  });

  it('ranks 1080p higher when user prefers 1080p first', () => {
    const customConfig: UserConfig = {
      ...baseConfig,
      preferredResolutions: ['1080p', '2160p'],
    };
    const cached = new Set([cand4kRemux.infoHash, cand1080pBluRay.infoHash]);
    const ranked = StreamRanker.rank([cand4kRemux, cand1080pBluRay], cached, customConfig);

    expect(ranked[0]?.candidate.infoHash).toBe(cand1080pBluRay.infoHash);
  });

  it('prioritizes cached RD+ releases over uncached releases', () => {
    const cached = new Set([cand1080pBluRay.infoHash]);
    const ranked = StreamRanker.rank([cand4kRemux, cand1080pBluRay], cached, baseConfig);

    expect(ranked[0]?.candidate.infoHash).toBe(cand1080pBluRay.infoHash);
    expect(ranked[0]?.isCached).toBe(true);
  });

  it('filters out releases exceeding maxFileSizeGb', () => {
    const sizeRestrictedConfig: UserConfig = {
      ...baseConfig,
      maxFileSizeGb: 15,
    };

    const ranked = StreamRanker.rank([cand4kRemux, cand1080pBluRay], new Set(), sizeRestrictedConfig);
    expect(ranked.length).toBe(1);
    expect(ranked[0]?.candidate.infoHash).toBe(cand1080pBluRay.infoHash);
  });

  it('limits results per quality bucket when maxResultsPerQuality is set', () => {
    const qualityLimitedConfig: UserConfig = {
      ...baseConfig,
      maxResultsPerQuality: 1, // Only 1 result allowed per resolution bucket
    };

    const list = [cand4kRemux, cand4kWeb, cand1080pBluRay, cand720pWeb];
    const ranked = StreamRanker.rank(list, new Set(), qualityLimitedConfig);

    // Out of two 4K candidates (cand4kRemux and cand4kWeb), only 1 should be kept
    const res4k = ranked.filter((r) => r.candidate.parsed?.resolution === '2160p');
    expect(res4k.length).toBe(1);
    expect(res4k[0]?.candidate.infoHash).toBe(cand4kRemux.infoHash);
  });

  it('produces deterministic ordering for identical inputs', () => {
    const list = [cand720pWeb, cand1080pBluRay, cand4kRemux];
    const run1 = StreamRanker.rank(list, new Set(), baseConfig).map((r) => r.candidate.infoHash);
    const run2 = StreamRanker.rank(list, new Set(), baseConfig).map((r) => r.candidate.infoHash);

    expect(run1).toEqual(run2);
  });
});
