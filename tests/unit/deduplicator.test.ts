import { describe, it, expect } from 'vitest';
import { Deduplicator } from '../../src/ranking/deduplicator.js';
import { ReleaseParser } from '../../src/parser/releaseParser.js';
import { TorrentCandidate } from '../../src/parser/types.js';

describe('Deduplicator', () => {
  it('deduplicates exact same infohash from different providers', () => {
    const raw1 = 'Inception.2010.1080p.BluRay.x264-SPARKS';
    const raw2 = 'Inception.2010.1080p.BluRay.x264-SPARKS.mkv';

    const hash = 'a1b2c3d4e5f6789012345678901234567890abcd';

    const candidates: TorrentCandidate[] = [
      {
        id: '1',
        provider: 'tpb',
        title: raw1,
        infoHash: hash,
        sizeBytes: 8000000000,
        seeders: 50,
        parsed: ReleaseParser.parse(raw1),
      },
      {
        id: '2',
        provider: 'yts',
        title: raw2,
        infoHash: hash,
        sizeBytes: 8000000000,
        seeders: 120, // higher seeders
        parsed: ReleaseParser.parse(raw2),
      },
    ];

    const deduplicated = Deduplicator.deduplicate(candidates);
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0]?.seeders).toBe(120); // should preserve highest seed count
  });

  it('deduplicates identical fingerprint releases with different infohashes', () => {
    const raw1 = 'The.Matrix.1999.2160p.UHD.Remux.HEVC-GROUPA';
    const raw2 = 'The Matrix 1999 2160p Remux x265 GROUPB';

    const candidates: TorrentCandidate[] = [
      {
        id: '1',
        provider: 'providerA',
        title: raw1,
        infoHash: '1111111111111111111111111111111111111111',
        sizeBytes: 45000000000,
        seeders: 15,
        parsed: ReleaseParser.parse(raw1),
      },
      {
        id: '2',
        provider: 'providerB',
        title: raw2,
        infoHash: '2222222222222222222222222222222222222222',
        sizeBytes: 45010000000, // virtually identical size (~45GB)
        seeders: 45,
        parsed: ReleaseParser.parse(raw2),
      },
    ];

    const deduplicated = Deduplicator.deduplicate(candidates);
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0]?.seeders).toBe(45);
  });

  it('preserves distinct releases (e.g. 1080p vs 2160p)', () => {
    const raw1 = 'Gladiator.2000.1080p.BluRay.x264';
    const raw2 = 'Gladiator.2000.2160p.BluRay.x265';

    const candidates: TorrentCandidate[] = [
      {
        id: '1',
        provider: 'providerA',
        title: raw1,
        infoHash: '3333333333333333333333333333333333333333',
        sizeBytes: 10000000000,
        seeders: 10,
        parsed: ReleaseParser.parse(raw1),
      },
      {
        id: '2',
        provider: 'providerB',
        title: raw2,
        infoHash: '4444444444444444444444444444444444444444',
        sizeBytes: 30000000000,
        seeders: 20,
        parsed: ReleaseParser.parse(raw2),
      },
    ];

    const deduplicated = Deduplicator.deduplicate(candidates);
    expect(deduplicated.length).toBe(2);
  });
});
