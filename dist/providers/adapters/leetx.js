import { MetadataNormalizer } from '../../metadata/normalizer.js';
export class LeetxAdapter {
    name = '1337x';
    displayName = '1337x';
    category = 'mainstream';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'https://1337x.to';
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.query1337x(queries[0], 'Movies');
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.query1337x(queries[0], 'TV');
    }
    async query1337x(query, category) {
        const candidates = [];
        try {
            const url = `${this.baseUrl}/category-search/${encodeURIComponent(query)}/${category}/1/`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
            });
            if (!res.ok)
                return [];
            const html = await res.text();
            // Match torrent rows in table
            const rowRegex = /<tr>[\s\S]*?<a href="\/torrent\/([0-9]+)\/([^"]+)\/"[\s\S]*?<td class="coll-2 seeds">([0-9]+)<\/td>[\s\S]*?<td class="coll-3 leeches">([0-9]+)<\/td>[\s\S]*?<\/tr>/gi;
            let match;
            while ((match = rowRegex.exec(html)) !== null) {
                const id = match[1];
                const rawSlug = match[2];
                const seeds = parseInt(match[3] || '0', 10);
                const leeches = parseInt(match[4] || '0', 10);
                if (!id || !rawSlug)
                    continue;
                const title = decodeURIComponent(rawSlug).replace(/[\._\-+]/g, ' ');
                // Check if magnet or hash is available in search row or construct placeholder
                const hashMatch = html.match(new RegExp(`urn:btih:([a-fA-F0-9]{40})`, 'i'));
                if (hashMatch && hashMatch[1]) {
                    candidates.push({
                        id: `1337x-${hashMatch[1].toLowerCase()}`,
                        provider: this.name,
                        title,
                        infoHash: hashMatch[1].toLowerCase(),
                        sizeBytes: 0,
                        seeders: seeds,
                        leechers: leeches,
                    });
                }
            }
        }
        catch {
            return [];
        }
        return candidates;
    }
    async healthCheck() {
        try {
            const res = await fetch(`${this.baseUrl}/`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
