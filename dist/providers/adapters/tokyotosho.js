import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { RssHelper } from '../rssHelper.js';
export class TokyoToshoAdapter {
    name = 'tokyotosho';
    displayName = 'TokyoTosho';
    category = 'anime';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'https://tokyotosho.info';
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchTokyo(queries[0]);
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchTokyo(queries[0]);
    }
    async searchTokyo(query) {
        const candidates = [];
        try {
            const url = `${this.baseUrl}/rss.php?terms=${encodeURIComponent(query)}`;
            const res = await fetch(url);
            if (!res.ok)
                return [];
            const xml = await res.text();
            const items = RssHelper.parseItems(xml);
            for (const item of items) {
                if (!item.infoHash || item.infoHash.length !== 40)
                    continue;
                candidates.push({
                    id: `tokyo-${item.infoHash}`,
                    provider: this.name,
                    title: item.title,
                    infoHash: item.infoHash,
                    sizeBytes: item.sizeBytes,
                    seeders: item.seeders || 5,
                    leechers: item.leechers,
                    magnetUri: item.magnetUri,
                });
            }
        }
        catch {
            return [];
        }
        return candidates;
    }
    async healthCheck() {
        try {
            const res = await fetch(`${this.baseUrl}/rss.php`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
