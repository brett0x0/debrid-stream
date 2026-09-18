import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { RssHelper } from '../rssHelper.js';
export class AniDexAdapter {
    name = 'anidex';
    displayName = 'AniDex';
    category = 'anime';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'https://anidex.info';
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchAniDex(queries[0]);
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchAniDex(queries[0]);
    }
    async searchAniDex(query) {
        const candidates = [];
        try {
            const url = `${this.baseUrl}/rss/?q=${encodeURIComponent(query)}`;
            const res = await fetch(url);
            if (!res.ok)
                return [];
            const xml = await res.text();
            const items = RssHelper.parseItems(xml);
            for (const item of items) {
                if (!item.infoHash || item.infoHash.length !== 40)
                    continue;
                candidates.push({
                    id: `anidex-${item.infoHash}`,
                    provider: this.name,
                    title: item.title,
                    infoHash: item.infoHash,
                    sizeBytes: item.sizeBytes,
                    seeders: item.seeders || 10,
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
            const res = await fetch(`${this.baseUrl}/rss/`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
