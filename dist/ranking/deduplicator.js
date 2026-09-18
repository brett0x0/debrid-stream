export class Deduplicator {
    /**
     * Deduplicates candidate torrents by:
     * 1. InfoHash (exact match)
     * 2. Fingerprint (normalized title + season + episode + resolution + approximate size)
     */
    static deduplicate(candidates) {
        const seenHashes = new Map();
        const result = [];
        for (const candidate of candidates) {
            const cleanHash = candidate.infoHash ? candidate.infoHash.toLowerCase().trim() : '';
            if (cleanHash && cleanHash.length === 40) {
                if (seenHashes.has(cleanHash)) {
                    // Candidate already exists; merge seeders/providers
                    const existing = seenHashes.get(cleanHash);
                    if (candidate.seeders > existing.seeders) {
                        existing.seeders = candidate.seeders;
                    }
                    continue;
                }
                else {
                    seenHashes.set(cleanHash, candidate);
                }
            }
            result.push(candidate);
        }
        // Secondary pass: Deduplicate by release fingerprint
        const fingerprinted = new Map();
        const finalCandidates = [];
        for (const candidate of result) {
            const p = candidate.parsed;
            if (!p) {
                finalCandidates.push(candidate);
                continue;
            }
            // Approximate size rounded to nearest 50MB to detect repackaged torrents
            const approxSizeMb = Math.round(candidate.sizeBytes / (50 * 1024 * 1024)) * 50;
            const normTitle = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const s = p.season ?? 0;
            const e = p.episode ?? 0;
            const res = p.resolution;
            const src = p.source;
            // Fingerprint: e.g. "fightclub:1999:0:0:2160p:remux:35000"
            const fingerprint = `${normTitle}:${p.year ?? ''}:${s}:${e}:${res}:${src}:${approxSizeMb}`;
            if (fingerprinted.has(fingerprint)) {
                const existing = fingerprinted.get(fingerprint);
                // Keep candidate with higher seed count or more detailed audio/HDR
                if (candidate.seeders > existing.seeders) {
                    const idx = finalCandidates.indexOf(existing);
                    if (idx !== -1) {
                        finalCandidates[idx] = candidate;
                        fingerprinted.set(fingerprint, candidate);
                    }
                }
            }
            else {
                fingerprinted.set(fingerprint, candidate);
                finalCandidates.push(candidate);
            }
        }
        return finalCandidates;
    }
}
