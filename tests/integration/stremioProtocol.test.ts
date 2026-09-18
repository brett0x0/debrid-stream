import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { FastifyInstance } from 'fastify';
import { encodeUserConfig, UserConfig } from '../../src/config/userConfig.js';

describe('Stremio Protocol Integration', () => {
  let app: FastifyInstance;
  let sampleConfig: UserConfig;
  let encodedConfig: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    sampleConfig = {
      rdToken: 'MOCK_RD_TOKEN_XYZ',
      maxResults: 20,
      maxResultsPerQuality: 0,
      preferredResolutions: ['2160p', '1080p', '720p'],
      preferredSources: ['REMUX', 'BluRay', 'WEB-DL'],
      preferredCodecs: ['HEVC', 'AVC'],
      maxFileSizeGb: 0,
      excludedResolutions: [],
      enabledProviders: ['yts', 'eztv', 'tpb'],
      showCachedOnly: true,
      sortOrder: 'quality_seeders',
    };

    encodedConfig = encodeUserConfig(sampleConfig, true);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /manifest.json returns valid unconfigured manifest', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/manifest.json',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.id).toBe('org.stremio.debridstream');
    expect(json.resources).toContain('stream');
    expect(json.types).toContain('movie');
    expect(json.types).toContain('series');
    expect(json.behaviorHints?.configurationRequired).toBe(true);
  });

  it('GET /:config/manifest.json returns configured manifest', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/${encodedConfig}/manifest.json`,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.id).toBe('org.stremio.debridstream');
    expect(json.behaviorHints?.configurationRequired).toBe(false);
  });

  it('GET /health returns health metrics and provider status', async () => {
    const origFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    try {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.status).toBe('ok');
      expect(json.metrics).toBeDefined();
      expect(json.providers).toBeDefined();
    } finally {
      global.fetch = origFetch;
    }
  });

  it('GET /:config/stream/movie/:id.json returns playable RD streams', async () => {
    const testHash = 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1';

    // Mock global fetch for Cinemeta, Providers, and RD
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      // Cinemeta mock
      if (url.includes('v3-cinemeta.strem.io')) {
        return {
          ok: true,
          json: async () => ({
            meta: {
              id: 'tt0137523',
              type: 'movie',
              name: 'Fight Club',
              year: 1999,
            },
          }),
        };
      }

      // YTS provider mock
      if (url.includes('yts.mx')) {
        return {
          ok: true,
          json: async () => ({
            status: 'ok',
            data: {
              movies: [
                {
                  title: 'Fight Club',
                  year: 1999,
                  torrents: [
                    {
                      quality: '1080p',
                      type: 'bluray',
                      hash: testHash,
                      size_bytes: 5000000000,
                      seeds: 100,
                      peers: 10,
                    },
                  ],
                },
              ],
            },
          }),
        };
      }

      // Real-Debrid instant availability mock
      if (url.includes('/torrents/instantAvailability/')) {
        return {
          ok: true,
          json: async () => ({
            [testHash]: {
              rd: [{ '1': { filename: 'Fight.Club.1999.1080p.mkv', filesize: 5000000000 } }],
            },
          }),
        };
      }

      return { ok: false, status: 404 };
    });

    try {
      const res = await app.inject({
        method: 'GET',
        url: `/${encodedConfig}/stream/movie/tt0137523.json`,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.streams).toBeDefined();
      expect(Array.isArray(json.streams)).toBe(true);
      expect(json.streams.length).toBeGreaterThan(0);

      const stream = json.streams[0];
      expect(stream.name).toContain('[RD+]');
      expect(stream.title).toContain('Fight Club');
      expect(stream.url).toContain(`/resolve/${encodedConfig}/${testHash}/0`);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('GET /resolve/:config/:infoHash/:fileIdx returns HTTP 302 redirect to Real-Debrid', async () => {
    const testHash = 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2';
    const mockCdnUrl = 'https://download.real-debrid.com/d/abc12345/FightClub.mp4';

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/torrents/addMagnet')) {
        return { ok: true, status: 201, json: async () => ({ id: 'torrent-1' }) };
      }
      if (url.includes('/torrents/selectFiles/')) {
        return { ok: true, status: 204 };
      }
      if (url.includes('/torrents/info/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'torrent-1',
            status: 'downloaded',
            links: ['https://real-debrid.com/d/abc12345'],
            files: [{ id: 1, path: '/FightClub.mp4', bytes: 1000000, selected: 1 }],
          }),
        };
      }
      if (url.includes('/unrestrict/link')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            download: mockCdnUrl,
            filename: 'FightClub.mp4',
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    try {
      const res = await app.inject({
        method: 'GET',
        url: `/resolve/${encodedConfig}/${testHash}/0`,
      });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe(mockCdnUrl);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
