import { MetadataNormalizer } from '../../metadata/normalizer.js';
export class KickassAdapter {
    name = 'kickass';
    displayName = 'KickassTorrents';
    category = 'mainstream';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'https://kickasstorrents.to';
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchKat(queries[0]);
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchKat(queries[0]);
    }
    async searchKat(query) {
        const candidates = [];
        try {
            const url = `${this.baseUrl}/usearch/${encodeURIComponent(query)}/`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                },
            });
            if (!res.ok)
                return [];
            const html = await res.text();
            // Extract magnet links and torrent titles
            const magnetRegex = /href="(magnet:\?xt=urn:btih:([a-fA-F0-9]{40})[^"]*)"/g;
            const titleRegex = /class="cellMainLink">([^<]+)<\/a>/g;
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
                    id: `kat-${item.hash}`,
                    provider: this.name,
                    title,
                    infoHash: item.hash,
                    sizeBytes: 0,
                    seeders: 15,
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
