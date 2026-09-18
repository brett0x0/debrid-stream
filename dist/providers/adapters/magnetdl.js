import { MetadataNormalizer } from '../../metadata/normalizer.js';
export class MagnetDlAdapter {
    name = 'magnetdl';
    displayName = 'MagnetDL';
    category = 'mainstream';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'https://www.magnetdl.com';
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchMagnetDl(queries[0]);
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        if (!queries[0])
            return [];
        return this.searchMagnetDl(queries[0]);
    }
    async searchMagnetDl(query) {
        const candidates = [];
        try {
            const clean = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            if (!clean)
                return [];
            const firstChar = clean[0];
            const slug = clean.split(/\s+/).join('-');
            const url = `${this.baseUrl}/${firstChar}/${slug}/`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                },
            });
            if (!res.ok)
                return [];
            const html = await res.text();
            // Find table rows with magnets
            const magnetRegex = /href="(magnet:\?xt=urn:btih:([a-fA-F0-9]{40})[^"]*)"\s+title="([^"]*)"/gi;
            let match;
            while ((match = magnetRegex.exec(html)) !== null) {
                const magnetUri = match[1];
                const hash = match[2].toLowerCase();
                const title = match[3] || 'Torrent';
                candidates.push({
                    id: `magnetdl-${hash}`,
                    provider: this.name,
                    title,
                    infoHash: hash,
                    sizeBytes: 0,
                    seeders: 10,
                    magnetUri,
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
