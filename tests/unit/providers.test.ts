import { describe, it, expect, vi } from 'vitest';
import { RssHelper } from '../../src/providers/rssHelper.js';
import { NyaaAdapter } from '../../src/providers/adapters/nyaa.js';
import { TokyoToshoAdapter } from '../../src/providers/adapters/tokyotosho.js';
import { AniDexAdapter } from '../../src/providers/adapters/anidex.js';
import { RarbgAdapter } from '../../src/providers/adapters/rarbg.js';
import { MediaMetadata } from '../../src/metadata/types.js';

describe('RssHelper', () => {
  it('parses RSS XML feed with infoHash, seeders, and magnets', () => {
    const mockXml = `
      <rss version="2.0" xmlns:nyaa="https://nyaa.si/xmlns/nyaa">
        <channel>
          <title>Nyaa</title>
          <item>
            <title>[SubsPlease] Frieren - 28 (1080p) [9812A4F1].mkv</title>
            <link>https://nyaa.si/download/123456.torrent</link>
            <nyaa:infoHash>1234567890abcdef1234567890abcdef12345678</nyaa:infoHash>
            <nyaa:seeders>150</nyaa:seeders>
            <nyaa:leechers>10</nyaa:leechers>
            <enclosure url="https://nyaa.si/download/123456.torrent" length="1400000000" type="application/x-bittorrent" />
          </item>
        </channel>
      </rss>
    `;

    const items = RssHelper.parseItems(mockXml);
    expect(items.length).toBe(1);
    expect(items[0]?.title).toBe('[SubsPlease] Frieren - 28 (1080p) [9812A4F1].mkv');
    expect(items[0]?.infoHash).toBe('1234567890abcdef1234567890abcdef12345678');
    expect(items[0]?.seeders).toBe(150);
    expect(items[0]?.sizeBytes).toBe(1400000000);
  });
});

describe('New Provider Adapters', () => {
  const animeMeta: MediaMetadata = {
    type: 'series',
    imdbId: 'tt1234567',
    title: 'Frieren',
    season: 1,
    episode: 28,
  };

  it('NyaaAdapter searches and parses RSS results', async () => {
    const adapter = new NyaaAdapter();
    const mockXml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Frieren S01E28 1080p</title>
            <link>magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</link>
          </item>
        </channel>
      </rss>
    `;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockXml,
    });

    try {
      const results = await adapter.searchSeries(animeMeta);
      expect(results.length).toBe(1);
      expect(results[0]?.infoHash).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(results[0]?.provider).toBe('nyaasi');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('TokyoToshoAdapter searches and parses RSS results', async () => {
    const adapter = new TokyoToshoAdapter();
    const mockXml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Frieren S01E28 720p</title>
            <link>magnet:?xt=urn:btih:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb</link>
          </item>
        </channel>
      </rss>
    `;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockXml,
    });

    try {
      const results = await adapter.searchSeries(animeMeta);
      expect(results.length).toBe(1);
      expect(results[0]?.infoHash).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      expect(results[0]?.provider).toBe('tokyotosho');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
