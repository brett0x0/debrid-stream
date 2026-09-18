import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealDebridClient, RealDebridError } from '../../src/debrid/realDebridClient.js';

describe('RealDebridClient', () => {
  let client: RealDebridClient;
  const mockToken = 'SECRET_RD_TOKEN_123456';

  beforeEach(() => {
    client = new RealDebridClient(2000);
  });

  it('validates user token and returns user profile', async () => {
    const mockUser = {
      id: 12345,
      username: 'moviebuff',
      email: 'user@example.com',
      points: 850,
      type: 'premium',
      expiration: '2026-12-31T23:59:59Z',
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockUser,
    });

    try {
      const user = await client.getUser(mockToken);
      expect(user.username).toBe('moviebuff');
      expect(user.type).toBe('premium');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('throws RealDebridError with 401 when token is invalid and hides token in error', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'bad_token' }),
    });

    try {
      await expect(client.getUser(mockToken)).rejects.toThrow(RealDebridError);
      try {
        await client.getUser(mockToken);
      } catch (err: any) {
        expect(err.statusCode).toBe(401);
        expect(err.message).not.toContain(mockToken); // Token must never leak!
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('batches instant availability queries for multiple hashes', async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        '1111111111111111111111111111111111111111': { rd: [{ '1': { filename: 'vid.mp4', filesize: 1000 } }] },
      }),
    });
    global.fetch = fetchMock;

    try {
      const hashes = [
        '1111111111111111111111111111111111111111',
        '2222222222222222222222222222222222222222',
      ];
      const result = await client.getInstantAvailability(hashes, mockToken);
      expect(fetchMock).toHaveBeenCalled();
      expect(result['1111111111111111111111111111111111111111']).toBeDefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('resolves playable stream through the complete RD flow', async () => {
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/torrents/addMagnet')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: 'torrent-xyz', uri: '...' }),
        };
      }
      if (url.includes('/torrents/selectFiles/')) {
        return {
          ok: true,
          status: 204,
        };
      }
      if (url.includes('/torrents/info/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'torrent-xyz',
            filename: 'Fight.Club.1999.1080p.mkv',
            status: 'downloaded',
            links: ['https://real-debrid.com/d/XYZ123'],
            files: [{ id: 1, path: '/Fight.Club.1999.1080p.mkv', bytes: 5000000, selected: 1 }],
          }),
        };
      }
      if (url.includes('/unrestrict/link')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'unrestrict-123',
            filename: 'Fight.Club.1999.1080p.mkv',
            download: 'https://download.real-debrid.com/stream/FightClub.mp4',
            link: 'https://real-debrid.com/d/XYZ123',
            host: 'real-debrid.com',
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    try {
      const stream = await client.resolvePlayableStream(
        'magnet:?xt=urn:btih:1111111111111111111111111111111111111111',
        mockToken
      );

      expect(stream.download).toBe('https://download.real-debrid.com/stream/FightClub.mp4');
      expect(stream.filename).toBe('Fight.Club.1999.1080p.mkv');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
