import { MetadataNormalizer } from '../../metadata/normalizer.js';
export class Torrent9Adapter {
    name = 'torrent9';
    displayName = 'Torrent9';
    category = 'regional';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'https://www.torrent9.to';
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchTorrent9(queries[0]);
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchTorrent9(queries[0]);
    }
    async searchTorrent9(query) {
        const candidates = [];
        try {
            const url = `${this.baseUrl}/recherche/${encodeURIComponent(query)}`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            if (!res.ok)
                return [];
            const html = await res.text();
            const magnetRegex = /href="(magnet:\?xt=urn:btih:([a-fA-F0-9]{40})[^"]*)"/gi;
            const titleRegex = /<a href="\/torrent\/[^"]+" title="([^"]+)">/gi;
            const magnets = [];
            let mMatch;
            while ((mMatch = magnetRegex.exec(html)) !== null) {
                if (mMatch[1] && mMatch[2]) {
                    magnets.push({ magnet: mMatch[1], hash: mMatch[2].toLowerCase() });
                }
            }
            const titles = [];
            let tMatch;
            while ((tMatch = titleRegex.exec(html)) !== null) {
                if (tMatch[1]) {
                    titles.push(tMatch[1].trim());
                }
            }
            for (let i = 0; i < Math.min(magnets.length, titles.length); i++) {
                const item = magnets[i];
                const title = titles[i];
                candidates.push({
                    id: `torrent9-${item.hash}`,
                    provider: this.name,
                    title,
                    infoHash: item.hash,
                    sizeBytes: 0,
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
