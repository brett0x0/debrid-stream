import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { safeFetch } from '../httpClient.js';
export class ThePirateBayAdapter {
    name = 'tpb';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'https://apibay.org';
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        // Search for all video (SD, HD, 4K, Remux)
        return this.queryApibay(queries[0], '200');
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        // Search for all video (SD, HD, 4K)
        return this.queryApibay(queries[0], '200');
    }
    async queryApibay(query, category) {
        const candidates = [];
        try {
            const url = `${this.baseUrl}/q.php?q=${encodeURIComponent(query)}&cat=${category}`;
            const res = await safeFetch(url);
            if (!res.ok)
                return [];
            const items = (await res.json());
            if (!Array.isArray(items))
                return [];
            for (const item of items) {
                if (!item.info_hash || item.id === '0' || item.name === 'No results returned') {
                    continue;
                }
                const cleanHash = item.info_hash.toLowerCase();
                const sizeBytes = parseInt(item.size, 10) || 0;
                const seeders = parseInt(item.seeders, 10) || 0;
                const leechers = parseInt(item.leechers, 10) || 0;
                candidates.push({
                    id: `tpb-${cleanHash}`,
                    provider: this.name,
                    title: item.name,
                    infoHash: cleanHash,
                    sizeBytes,
                    seeders,
                    leechers,
                    magnetUri: `magnet:?xt=urn:btih:${cleanHash}&dn=${encodeURIComponent(item.name)}`,
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
            const res = await safeFetch(`${this.baseUrl}/q.php?q=test&cat=200`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
