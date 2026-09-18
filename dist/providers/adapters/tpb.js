import { MetadataNormalizer } from '../../metadata/normalizer.js';
import { safeFetch } from '../httpClient.js';
import { logger } from '../../observability/logger.js';
export class ThePirateBayAdapter {
    name = 'tpb';
    supportedTypes = ['movie', 'series'];
    baseUrl = 'https://apibay.org';
    mirrorUrls = ['https://tpb.party', 'https://thepiratebay10.org'];
    async searchMovie(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        let results = [];
        if (queries[0]) {
            results = await this.queryTpb(queries[0], '200');
        }
        if (results.length < 5 && meta.imdbId) {
            const imdbResults = await this.queryTpb(meta.imdbId, '200');
            results = [...results, ...imdbResults];
        }
        return results;
    }
    async searchSeries(meta) {
        const queries = MetadataNormalizer.buildSearchQueries(meta);
        let results = [];
        if (queries[0]) {
            results = await this.queryTpb(queries[0], '200');
        }
        if (results.length < 5 && meta.imdbId) {
            const imdbResults = await this.queryTpb(meta.imdbId, '200');
            results = [...results, ...imdbResults];
        }
        return results;
    }
    async queryTpb(query, category) {
        // 1. Try apibay.org first (fast JSON API for residential/unblocked environments)
        try {
            const candidates = await this.queryApibay(query, category);
            if (candidates.length > 0) {
                return candidates;
            }
        }
        catch {
            // Fall through to mirrors
        }
        // 2. Fall back to TPB web mirrors (unblocked in datacenter/cloud environments like Render)
        for (const mirror of this.mirrorUrls) {
            try {
                const candidates = await this.queryMirror(mirror, query, category);
                if (candidates.length > 0) {
                    return candidates;
                }
            }
            catch (err) {
                logger.warn({ provider: this.name, mirror, query, err: err.message }, 'TPB mirror fetch failed');
            }
        }
        return [];
    }
    async queryApibay(query, category) {
        const candidates = [];
        try {
            const url = `${this.baseUrl}/q.php?q=${encodeURIComponent(query)}&cat=${category}`;
            const res = await safeFetch(url);
            if (!res.ok) {
                return [];
            }
            const items = (await res.json());
            if (!Array.isArray(items)) {
                return [];
            }
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
    async queryMirror(mirror, query, category) {
        const url = `${mirror}/search/${encodeURIComponent(query)}/1/99/${category}`;
        const res = await safeFetch(url);
        if (!res.ok) {
            return [];
        }
        const html = await res.text();
        const candidates = [];
        const rowRegex = /<tr[^>]*>[\s\S]*?title="Details for ([^"]+)"[\s\S]*?href="(magnet:\?xt=urn:btih:([a-fA-F0-9]{40})[^"]*)"[\s\S]*?<td align="right">([0-9\.]+)(?:&nbsp;|\s*)([KMGTP]?i?B)<\/td>[\s\S]*?<td align="right">([0-9]+)<\/td>[\s\S]*?<td align="right">([0-9]+)<\/td>[\s\S]*?<\/tr>/gi;
        let match;
        while ((match = rowRegex.exec(html)) !== null) {
            const title = match[1];
            const magnet = match[2];
            const cleanHash = match[3].toLowerCase();
            const sizeVal = parseFloat(match[4]);
            const sizeUnit = match[5].toUpperCase();
            const seeders = parseInt(match[6], 10) || 0;
            const leechers = parseInt(match[7], 10) || 0;
            let multiplier = 1;
            if (sizeUnit.includes('K'))
                multiplier = 1024;
            else if (sizeUnit.includes('M'))
                multiplier = 1024 * 1024;
            else if (sizeUnit.includes('G'))
                multiplier = 1024 * 1024 * 1024;
            else if (sizeUnit.includes('T'))
                multiplier = 1024 * 1024 * 1024 * 1024;
            const sizeBytes = Math.round(sizeVal * multiplier);
            candidates.push({
                id: `tpb-${cleanHash}`,
                provider: this.name,
                title,
                infoHash: cleanHash,
                sizeBytes,
                seeders,
                leechers,
                magnetUri: magnet,
            });
        }
        return candidates;
    }
    async healthCheck() {
        try {
            const res = await safeFetch(`${this.baseUrl}/q.php?q=test&cat=200`);
            if (res.ok)
                return true;
            const mirrorRes = await safeFetch(`${this.mirrorUrls[0]}/search/test/1/99/200`);
            return mirrorRes.ok;
        }
        catch {
            return false;
        }
    }
}
