import { safeFetch } from '../httpClient.js';
export class YtsAdapter {
    name = 'yts';
    supportedTypes = ['movie'];
    baseUrl = 'https://yts.mx/api/v2';
    async searchMovie(meta) {
        const candidates = [];
        const query = meta.imdbId || meta.title;
        try {
            const url = `${this.baseUrl}/list_movies.json?query_term=${encodeURIComponent(query)}`;
            const res = await safeFetch(url);
            if (!res.ok)
                return [];
            const data = (await res.json());
            if (!data.data || !data.data.movies)
                return [];
            for (const movie of data.data.movies) {
                if (!movie.torrents)
                    continue;
                for (const tor of movie.torrents) {
                    if (!tor.hash)
                        continue;
                    const cleanHash = tor.hash.toLowerCase();
                    const title = `${movie.title} (${movie.year}) [${tor.quality}] [${tor.type.toUpperCase()}] [YTS]`;
                    candidates.push({
                        id: `yts-${cleanHash}`,
                        provider: this.name,
                        title,
                        infoHash: cleanHash,
                        sizeBytes: tor.size_bytes || 0,
                        seeders: tor.seeds || 0,
                        leechers: tor.peers || 0,
                        magnetUri: `magnet:?xt=urn:btih:${cleanHash}&dn=${encodeURIComponent(title)}`,
                    });
                }
            }
        }
        catch {
            return [];
        }
        return candidates;
    }
    async searchSeries(_meta) {
        return []; // YTS does not index series
    }
    async healthCheck() {
        try {
            const res = await safeFetch(`${this.baseUrl}/list_movies.json?limit=1`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
