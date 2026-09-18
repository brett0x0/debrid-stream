import { PATTERNS } from './patterns.js';
export class ReleaseParser {
    /**
     * Parses a raw release name or filename into structured metadata.
     */
    static parse(raw) {
        const rawTitle = (raw || '').trim();
        // 1. Container
        let container;
        const containerMatch = rawTitle.match(PATTERNS.container);
        if (containerMatch && containerMatch[1]) {
            container = containerMatch[1].toLowerCase();
        }
        // 2. Release Group
        let releaseGroup;
        // Check trailing hyphen format: "...-GROUP.mkv" or "...-GROUP"
        const groupMatch = rawTitle.replace(PATTERNS.container, '').match(/[-_\s]([a-zA-Z0-9]+)$/);
        if (groupMatch && groupMatch[1] && groupMatch[1].length > 1 && !/^(mkv|mp4|avi|720p|1080p|2160p|4k|x264|x265|hevc|web|dl)$/i.test(groupMatch[1])) {
            releaseGroup = groupMatch[1];
        }
        else {
            // Check prefix bracket format: "[GROUP] Title"
            const prefixMatch = rawTitle.match(/^\[([a-zA-Z0-9_\- ]+)\]/);
            if (prefixMatch && prefixMatch[1]) {
                releaseGroup = prefixMatch[1].trim();
            }
        }
        // 3. Resolution
        let resolution = 'unknown';
        for (const item of PATTERNS.resolution) {
            if (item.pattern.test(rawTitle)) {
                resolution = item.value;
                break;
            }
        }
        // 4. Source Quality
        let source = 'unknown';
        for (const item of PATTERNS.source) {
            if (item.pattern.test(rawTitle)) {
                source = item.value;
                break;
            }
        }
        // 5. Video Codec
        let codec = 'unknown';
        for (const item of PATTERNS.codec) {
            if (item.pattern.test(rawTitle)) {
                codec = item.value;
                break;
            }
        }
        // 6. Audio Codec & Channels
        let audioCodec = 'Unknown';
        for (const item of PATTERNS.audioCodec) {
            if (item.pattern.test(rawTitle)) {
                audioCodec = item.value;
                break;
            }
        }
        let audioChannels = 'Unknown';
        for (const item of PATTERNS.audioChannels) {
            if (item.pattern.test(rawTitle)) {
                audioChannels = item.value;
                break;
            }
        }
        const audio = {
            codec: audioCodec,
            channels: audioChannels,
        };
        // 7. HDR Information
        const dolbyVision = PATTERNS.hdr.dolbyVision.test(rawTitle);
        const hdr10plus = PATTERNS.hdr.hdr10plus.test(rawTitle);
        const hdr10 = PATTERNS.hdr.hdr10.test(rawTitle);
        const hdr = dolbyVision || hdr10plus || hdr10 || PATTERNS.hdr.hdr.test(rawTitle);
        const hdrInfo = {
            hdr,
            hdr10,
            hdr10plus,
            dolbyVision,
        };
        // 8. Bit Depth
        let bitDepth;
        for (const item of PATTERNS.bitDepth) {
            if (item.pattern.test(rawTitle)) {
                bitDepth = item.value;
                break;
            }
        }
        // 9. Flags
        const proper = PATTERNS.flags.proper.test(rawTitle);
        const repack = PATTERNS.flags.repack.test(rawTitle);
        const remastered = PATTERNS.flags.remastered.test(rawTitle);
        // 10. Season and Episode Parsing
        let season;
        let episode;
        let episodes;
        let isCompleteSeason = false;
        // Check complete season: "S01 Complete" or "Season 1"
        const completeSeasonMatch = rawTitle.match(/\b(?:s(?:eason)?\s*([0-9]{1,2}))[\s._-]*(?:complete|full|pack|all\.episodes)?\b/i);
        if (/\b(?:complete|full|pack|all\.episodes)\b/i.test(rawTitle) && completeSeasonMatch && completeSeasonMatch[1]) {
            season = parseInt(completeSeasonMatch[1], 10);
            isCompleteSeason = true;
        }
        // Standard S01E02 or S01E01-E04
        const sxeMatch = rawTitle.match(/\b[sS]([0-9]{1,2})[eE]([0-9]{1,3})(?:-[eE]?([0-9]{1,3}))?\b/);
        if (sxeMatch && sxeMatch[1] && sxeMatch[2]) {
            season = parseInt(sxeMatch[1], 10);
            episode = parseInt(sxeMatch[2], 10);
            isCompleteSeason = false;
            if (sxeMatch[3]) {
                const endEp = parseInt(sxeMatch[3], 10);
                episodes = [];
                for (let i = episode; i <= endEp; i++) {
                    episodes.push(i);
                }
            }
        }
        else {
            // 1x02 format
            const altEpMatch = rawTitle.match(/\b([0-9]{1,2})x([0-9]{1,3})\b/i);
            if (altEpMatch && altEpMatch[1] && altEpMatch[2]) {
                season = parseInt(altEpMatch[1], 10);
                episode = parseInt(altEpMatch[2], 10);
            }
            else {
                // Standalone episode without season (e.g. Anime: "Title - 05 [1080p]")
                const animeMatch = rawTitle.match(/(?:[\s._-]|^)(?:ep|e|episode)?\s*([0-9]{2,3})\b/i);
                if (animeMatch && animeMatch[1] && !season && !resolution.includes(animeMatch[1])) {
                    const num = parseInt(animeMatch[1], 10);
                    if (num > 0 && num < 1000) {
                        episode = num;
                    }
                }
            }
        }
        // 11. Year Parsing (1900-2099)
        let year;
        const yearMatch = rawTitle.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
        if (yearMatch && yearMatch[1]) {
            year = parseInt(yearMatch[1], 10);
        }
        // 12. Extracted Clean Title
        // We isolate the title portion before season/episode, year, or resolution tags
        let title = rawTitle;
        // Remove group prefix if present (e.g. "[SubsPlease] ")
        title = title.replace(/^\[[^\]]+\]\s*/, '');
        // Find the first cutoff index among year, season, resolution, source
        const cutoffRegex = /\b(?:19[5-9]\d|20[0-3]\d|[sS][0-9]{1,2}|2160p|1080p|720p|480p|bluray|remux|web-?dl|web-?rip|hdtv)\b/i;
        const cutoffMatch = title.match(cutoffRegex);
        if (cutoffMatch && cutoffMatch.index !== undefined && cutoffMatch.index > 0) {
            title = title.substring(0, cutoffMatch.index);
        }
        // Replace dots, underscores, dashes with spaces
        title = title.replace(/[\._\-+]/g, ' ').replace(/\s+/g, ' ').trim();
        return {
            rawTitle,
            title,
            year,
            season,
            episode,
            episodes,
            isCompleteSeason,
            resolution,
            source,
            codec,
            audio,
            hdr: hdrInfo,
            bitDepth,
            releaseGroup,
            container,
            proper,
            repack,
            remastered,
        };
    }
}
