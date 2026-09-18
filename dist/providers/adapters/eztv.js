import { safeFetch } from '../httpClient.js';
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
            const res = await safeFetch(url);
            if (!res.ok)
                return [];
            const data = (await res.json());
            if (!data.torrents || !Array.isArray(data.torrents))
                return [];
            for (const tor of data.torrents) {
                if (!tor.hash)
                    continue;
                const cleanHash = tor.hash.toLowerCase();
                // If specific episode requested, verify filename contains SxxExx
                if (meta.season && meta.episode) {
                    const sStr = String(meta.season).padStart(2, '0');
                    const eStr = String(meta.episode).padStart(2, '0');
                    const epPattern = new RegExp(`s${sStr}e${eStr}`, 'i');
                    if (!epPattern.test(tor.filename)) {
                        continue;
                    }
                }
                const sizeBytes = typeof tor.size_bytes === 'number' ? tor.size_bytes : parseInt(String(tor.size_bytes), 10) || 0;
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
            const res = await safeFetch(`${this.baseUrl}/get-torrents?limit=1`);
            return res.ok;
        }
        catch {
            return false;
        }
    }
}
