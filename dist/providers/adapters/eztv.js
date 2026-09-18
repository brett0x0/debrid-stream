export class EztvAdapter {
    name = 'eztv';
    supportedTypes = ['series'];
    baseUrl = 'https://eztv.re/api';
    async searchMovie(_meta) {
        return []; // EZTV does not index movies
    }
    async searchSeries(meta) {
        const candidates = [];
        if (!meta.imdbId)
            return [];
        // Strip "tt" prefix for EZTV (e.g. "tt0903747" -> "0903747")
        const numericImdb = meta.imdbId.replace(/^tt/, '');
        try {
            const url = `${this.baseUrl}/get-torrents?imdb_id=${numericImdb}&limit=100`;
            const res = await fetch(url);
            if (!res.ok)
                return [];
            const data = (await res.json());
            if (!data.torrents || !Array.isArray(data.torrents))
                return [];
            for (const tor of data.torrents) {
                if (!tor.hash)
                    continue;
                // If specific season & episode requested, filter
                if (meta.season !== undefined && meta.episode !== undefined) {
                    const s = parseInt(tor.season, 10);
                    const e = parseInt(tor.episode, 10);
                    if (s !== meta.season || e !== meta.episode) {
                        continue;
                    }
                }
                const cleanHash = tor.hash.toLowerCase();
                const sizeBytes = typeof tor.size_bytes === 'string' ? parseInt(tor.size_bytes, 10) : tor.size_bytes || 0;
                candidates.push({
                    id: `eztv-${cleanHash}`,
                    provider: this.name,
                    title: tor.filename,
                    infoHash: cleanHash,
                    sizeBytes,
                    seeders: tor.seeds || 0,
                    leechers: tor.peers || 0,
                    magnetUri: tor.magnet_url || `magnet:?xt=urn:btih:${cleanHash}&dn=${encodeURIComponent(tor.filename)}`,
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
            const res = await fetch(`${this.baseUrl}/get-torrents?limit=1`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
