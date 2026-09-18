import { describe, it, expect, vi } from 'vitest';
import { MetadataNormalizer } from '../../src/metadata/normalizer.js';
import { CinemetaClient } from '../../src/metadata/cinemeta.js';

describe('MetadataNormalizer', () => {
  it('cleans titles with punctuation, accents, and unicode', () => {
    expect(MetadataNormalizer.cleanTitle("Amélie (2001)")).toBe('Amelie 2001');
    expect(MetadataNormalizer.cleanTitle("Grey's Anatomy")).toBe('Greys Anatomy');
    expect(MetadataNormalizer.cleanTitle("Fast & Furious")).toBe('Fast and Furious');
    expect(MetadataNormalizer.cleanTitle("Spider-Man: Across the Spider-Verse")).toBe('Spider Man Across the Spider Verse');
  });

  it('builds queries for movies', () => {
    const queries = MetadataNormalizer.buildSearchQueries({
      type: 'movie',
      imdbId: 'tt0137523',
      title: 'Fight Club',
      year: 1999,
    });

    expect(queries).toContain('Fight Club 1999');
    expect(queries).toContain('Fight Club');
  });

  it('builds queries for series episodes', () => {
    const queries = MetadataNormalizer.buildSearchQueries({
      type: 'series',
      imdbId: 'tt0903747',
      title: 'Breaking Bad',
      season: 1,
      episode: 5,
    });

    expect(queries).toContain('Breaking Bad S01E05');
    expect(queries).toContain('Breaking Bad 1x05');
  });

  it('verifies candidate matches correctly for movies', () => {
    const meta = {
      type: 'movie' as const,
      imdbId: 'tt0137523',
      title: 'Fight Club',
      year: 1999,
    };

    expect(MetadataNormalizer.isMatch('Fight.Club.1999.1080p.BluRay', meta)).toBe(true);
    expect(MetadataNormalizer.isMatch('Fight.Club.2015.Fake.Movie', meta)).toBe(false); // wrong year (> 1 year diff)
    expect(MetadataNormalizer.isMatch('The.Club.1999.720p', meta)).toBe(false); // missing 'Fight'
  });

  it('verifies candidate matches correctly for TV episodes', () => {
    const meta = {
      type: 'series' as const,
      imdbId: 'tt0903747',
      title: 'Breaking Bad',
      season: 5,
      episode: 14,
    };

    expect(MetadataNormalizer.isMatch('Breaking.Bad.S05E14.Ozymandias.1080p.mkv', meta)).toBe(true);
    expect(MetadataNormalizer.isMatch('Breaking.Bad.5x14.mkv', meta)).toBe(true);
    expect(MetadataNormalizer.isMatch('Breaking.Bad.S05E13.mkv', meta)).toBe(false); // wrong episode
    expect(MetadataNormalizer.isMatch('Breaking.Bad.S01E14.mkv', meta)).toBe(false); // wrong season
  });
});

describe('CinemetaClient', () => {
  it('resolves mocked movie metadata', async () => {
    const client = new CinemetaClient();

    // Mock global fetch
    const mockResponse = {
      meta: {
        id: 'tt0137523',
        type: 'movie',
        name: 'Fight Club',
        year: '1999',
      },
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    try {
      const meta = await client.resolve('movie', 'tt0137523');
      expect(meta).not.toBeNull();
      expect(meta?.title).toBe('Fight Club');
      expect(meta?.year).toBe(1999);
      expect(meta?.type).toBe('movie');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('resolves mocked series episode metadata', async () => {
    const client = new CinemetaClient();

    const mockResponse = {
      meta: {
        id: 'tt0903747',
        type: 'series',
        name: 'Breaking Bad',
        year: '2008',
        videos: [
          { season: 1, episode: 1, title: 'Pilot' },
          { season: 1, episode: 2, title: "Cat's in the Bag..." },
        ],
      },
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    try {
      const meta = await client.resolve('series', 'tt0903747:1:2');
      expect(meta).not.toBeNull();
      expect(meta?.title).toBe('Breaking Bad');
      expect(meta?.season).toBe(1);
      expect(meta?.episode).toBe(2);
      expect(meta?.episodeTitle).toBe("Cat's in the Bag...");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
