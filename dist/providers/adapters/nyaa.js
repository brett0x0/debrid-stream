import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { RssHelper } from '../rssHelper.js';
import { safeFetch } from '../httpClient.js';
export class NyaaAdapter {
    name = 'nyaasi';
    displayName = 'NyaaSi';
    category = 'anime';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'https://nyaa.si';
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchNyaa(queries[0]);
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchNyaa(queries[0]);
    }
    async searchNyaa(query) {
        const candidates = [];
        try {
            const url = `${this.baseUrl}/?page=rss&q=${encodeURIComponent(query)}&c=0_0&f=0`;
            const res = await safeFetch(url);
            if (!res.ok)
                return [];
            const xml = await res.text();
            const items = RssHelper.parseItems(xml);
            for (const item of items) {
                if (!item.infoHash || item.infoHash.length !== 40)
                    continue;
                candidates.push({
                    id: `nyaa-${item.infoHash}`,
                    provider: this.name,
                    title: item.title,
                    infoHash: item.infoHash,
                    sizeBytes: item.sizeBytes,
                    seeders: item.seeders,
                    leechers: item.leechers,
                    magnetUri: item.magnetUri || `magnet:?xt=urn:btih:${item.infoHash}&dn=${encodeURIComponent(item.title)}`,
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
            const res = await safeFetch(`${this.baseUrl}/?page=rss&limit=1`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
