export class StreamRanker {
    /**
     * Scores and sorts candidates deterministically according to user preferences and RD cache status.
     */
    static rank(candidates, cachedHashes, config) {
        const scored = [];
        const maxBytes = config.maxFileSizeGb > 0 ? config.maxFileSizeGb * 1024 * 1024 * 1024 : Infinity;
        for (const candidate of candidates) {
            // 1. File size filter
            if (candidate.sizeBytes > 0 && candidate.sizeBytes > maxBytes) {
                continue;
            }
            const p = candidate.parsed;
            const res = p?.resolution ?? 'unknown';
            // 2. Excluded resolution filter
            if (config.excludedResolutions.includes(res)) {
                continue;
            }
            const cleanHash = candidate.infoHash.toLowerCase();
            const isCached = cachedHashes.has(cleanHash);
            // 3. Show cached only filter
            if (config.showCachedOnly && !isCached) {
                continue;
            }
            let score = 0;
            // 4. Cached RD Bonus (RD+ streams prioritized)
            if (isCached) {
                score += 100000;
            }
            // 5. Resolution Scoring based on user's preference order
            const resIdx = config.preferredResolutions.indexOf(res);
            if (resIdx !== -1) {
                score += Math.max(10000 - resIdx * 2500, 1000);
            }
            else {
                score += 500;
            }
            // 6. Source Quality Scoring based on user's preference order
            const src = p?.source ?? 'unknown';
            const srcIdx = config.preferredSources.indexOf(src);
            if (srcIdx !== -1) {
                score += Math.max(3000 - srcIdx * 600, 300);
            }
            // 7. Video Codec Scoring based on user's preference order
            const codec = p?.codec ?? 'unknown';
            const codecIdx = config.preferredCodecs.indexOf(codec);
            if (codecIdx !== -1) {
                score += Math.max(1000 - codecIdx * 300, 100);
            }
            // 8. HDR / Dolby Vision
            if (p?.hdr) {
                if (p.hdr.dolbyVision || p.hdr.hdr10plus) {
                    score += 500;
                }
                else if (p.hdr.hdr) {
                    score += 300;
                }
            }
            // 9. Audio Quality
            if (p?.audio) {
                if (p.audio.codec === 'Atmos' || p.audio.codec === 'TrueHD' || p.audio.codec === 'DTS-HD MA') {
                    score += 400;
                }
                else if (p.audio.codec === 'DTS' || p.audio.codec === 'EAC3') {
                    score += 200;
                }
                if (p.audio.channels === '7.1') {
                    score += 150;
                }
                else if (p.audio.channels === '5.1') {
                    score += 100;
                }
            }
            // 10. Seeders bonus
            score += Math.min(candidate.seeders || 0, 500) * 0.1;
            scored.push({
                candidate,
                score,
                isCached,
                fileIdx: candidate.fileIdx ?? 0,
            });
        }
        // Sort deterministically
        scored.sort((a, b) => {
            if (config.sortOrder === 'size') {
                if (b.candidate.sizeBytes !== a.candidate.sizeBytes) {
                    return b.candidate.sizeBytes - a.candidate.sizeBytes;
                }
            }
            else if (config.sortOrder === 'seeders') {
                if (b.candidate.seeders !== a.candidate.seeders) {
                    return b.candidate.seeders - a.candidate.seeders;
                }
            }
            else if (config.sortOrder === 'quality_size') {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                if (b.candidate.sizeBytes !== a.candidate.sizeBytes) {
                    return b.candidate.sizeBytes - a.candidate.sizeBytes;
                }
            }
            else {
                // Default: quality_seeders
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                if (b.candidate.seeders !== a.candidate.seeders) {
                    return b.candidate.seeders - a.candidate.seeders;
                }
            }
            // Deterministic tie-breaker: infoHash string comparison
            return a.candidate.infoHash.localeCompare(b.candidate.infoHash);
        });
        // Handle Max Results per Quality limit if specified
        let filtered = scored;
        if (config.maxResultsPerQuality > 0) {
            const countsByQuality = new Map();
            const qualityBucketed = [];
            for (const item of scored) {
                const q = item.candidate.parsed?.resolution || 'unknown';
                const currentCount = countsByQuality.get(q) || 0;
                if (currentCount < config.maxResultsPerQuality) {
                    qualityBucketed.push(item);
                    countsByQuality.set(q, currentCount + 1);
                }
            }
            filtered = qualityBucketed;
        }
        return filtered.slice(0, config.maxResults);
    }
}
