export class MetadataNormalizer {
    /**
     * Normalizes a title by stripping accents, symbols, extra whitespace,
     * and standardizing punctuation.
     */
    static cleanTitle(title) {
        if (!title)
            return '';
        return title
            .normalize('NFKD') // Split accents
            .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
            .replace(/['’`]/g, '') // Remove apostrophes (e.g. Don't -> Dont)
            .replace(/&/g, ' and ') // Replace & with 'and'
            .replace(/[^\w\s]/g, ' ') // Replace non-alphanumeric with space
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim();
    }
    /**
     * Builds standardized search queries for torrent indexers.
     */
    static buildSearchQueries(meta) {
        const clean = this.cleanTitle(meta.title);
        const queries = [];
        if (meta.type === 'movie') {
            if (meta.year) {
                queries.push(`${clean} ${meta.year}`);
            }
            queries.push(clean);
        }
        else if (meta.type === 'series' && meta.season !== undefined && meta.episode !== undefined) {
            const s = String(meta.season).padStart(2, '0');
            const e = String(meta.episode).padStart(2, '0');
            // Standard S01E02
            queries.push(`${clean} S${s}E${e}`);
            // Alternative 1x02
            queries.push(`${clean} ${meta.season}x${e}`);
            // Season pack search fallback if needed
            queries.push(`${clean} S${s}`);
        }
        return Array.from(new Set(queries));
    }
    /**
     * Determines if a candidate torrent matches the requested media target.
     */
    static isMatch(candidateTitle, meta) {
        const normCand = this.cleanTitle(candidateTitle).toLowerCase();
        const normTarget = this.cleanTitle(meta.title).toLowerCase();
        // The candidate must at least contain the core target words
        const targetWords = normTarget.split(' ').filter((w) => w.length > 1);
        const hasAllWords = targetWords.every((w) => normCand.includes(w));
        if (!hasAllWords) {
            return false;
        }
        if (meta.type === 'movie' && meta.year) {
            // If candidate has a 4-digit year, it should match within +/- 1 year
            const yearMatch = candidateTitle.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
            if (yearMatch && yearMatch[1]) {
                const candYear = parseInt(yearMatch[1], 10);
                if (Math.abs(candYear - meta.year) > 1) {
                    return false;
                }
            }
        }
        if (meta.type === 'series' && meta.season !== undefined && meta.episode !== undefined) {
            const s = meta.season;
            const e = meta.episode;
            // Check S01E02 or 1x02 or multi-episode
            const sxe = new RegExp(`\\b[sS]0?${s}[eE]0?${e}\\b`, 'i');
            const alt = new RegExp(`\\b0?${s}x0?${e}\\b`, 'i');
            const completeSeason = new RegExp(`\\b[sS]0?${s}\\b.*\\b(?:complete|season|pack)\\b`, 'i');
            if (!sxe.test(candidateTitle) && !alt.test(candidateTitle) && !completeSeason.test(candidateTitle)) {
                return false;
            }
        }
        return true;
    }
}
