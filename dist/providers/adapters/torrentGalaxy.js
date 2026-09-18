import { MetadataNormalizer } from '../../metadata/normalizer.js';
export class TorrentGalaxyAdapter {
    name = 'torrentgalaxy';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'https://torrentgalaxy.to';
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchTgx(queries[0]);
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchTgx(queries[0]);
    }
    async searchTgx(query) {
        const candidates = [];
        try {
            const url = `${this.baseUrl}/torrents.php?search=${encodeURIComponent(query)}&sort=seeders&order=desc`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
            });
            if (!res.ok)
                return [];
            const html = await res.text();
            // Extract magnet links and titles from html
            // Magnet regex: magnet:\?xt=urn:btih:([a-zA-Z0-9]{40})
            const magnetRegex = /href="(magnet:\?xt=urn:btih:([a-zA-Z0-9]{40})[^"]*)"/g;
            const titleRegex = /title="([^"]+)"[^>]*class="txlight"/g;
            let match;
            const magnets = [];
            while ((match = magnetRegex.exec(html)) !== null) {
                if (match[1] && match[2]) {
                    magnets.push({
                        magnet: match[1],
                        hash: match[2].toLowerCase(),
                    });
                }
            }
            let titleMatch;
            const titles = [];
            while ((titleMatch = titleRegex.exec(html)) !== null) {
                if (titleMatch[1]) {
                    titles.push(titleMatch[1]);
                }
            }
            for (let i = 0; i < Math.min(magnets.length, titles.length); i++) {
                const item = magnets[i];
                const title = titles[i];
                candidates.push({
                    id: `tgx-${item.hash}`,
                    provider: this.name,
                    title,
                    infoHash: item.hash,
                    sizeBytes: 0, // Fallback if size regex isn't matched
                    seeders: 10,
                    magnetUri: item.magnet,
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
            const res = await fetch(`${this.baseUrl}/`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
