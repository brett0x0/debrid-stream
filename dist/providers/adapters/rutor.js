import { MetadataNormalizer } from '../../metadata/normalizer.js';
export class RutorAdapter {
    name = 'rutor';
    displayName = 'Rutor';
    category = 'regional';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'http://rutor.info';
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchRutor(queries[0]);
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchRutor(queries[0]);
    }
    async searchRutor(query) {
        const candidates = [];
        try {
            const url = `${this.baseUrl}/search/0/0/0/0/${encodeURIComponent(query)}`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            if (!res.ok)
                return [];
            const html = await res.text();
            const magnetRegex = /href="(magnet:\?xt=urn:btih:([a-fA-F0-9]{40})[^"]*)"/gi;
            const titleRegex = /<a href="\/torrent\/[0-9]+\/[^"]+">([^<]+)<\/a>/gi;
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
                    id: `rutor-${item.hash}`,
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
            const res = await fetch(`${this.baseUrl}/`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
