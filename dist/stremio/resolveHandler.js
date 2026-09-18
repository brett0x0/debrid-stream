import { CacheManager } from '../cache/cacheManager.js';
import { logger } from '../observability/logger.js';
export class ResolveHandler {
    rdClient;
    cache;
    constructor(rdClient, cache) {
        this.rdClient = rdClient;
        this.cache = cache;
    }
    /**
     * Resolves an infoHash and file index into a playable Real-Debrid streaming URL.
     */
    async resolve(config, infoHash, fileIdx = 0, mediaType, mediaId) {
        const cleanHash = infoHash.toLowerCase().trim();
        const streamKey = CacheManager.getRdStreamKey(cleanHash, fileIdx);
        // 1. Check L4 stream URL cache
        const cachedUrl = await this.cache.get(streamKey);
        if (cachedUrl) {
            return cachedUrl;
        }
        try {
            let torrentId;
            // 2. Check if already present in user's active/completed torrents
            try {
                const userTorrents = await this.rdClient.getUserTorrents(config.rdToken, 50);
                const existing = userTorrents.find((t) => t.hash.toLowerCase() === cleanHash);
                if (existing) {
                    torrentId = existing.id;
                }
            }
            catch {
                // Fall through to addMagnet
            }
            // 3. Add magnet to Real-Debrid if not already in user's account
            if (!torrentId) {
                const magnet = `magnet:?xt=urn:btih:${cleanHash}`;
                try {
                    const added = await this.rdClient.addMagnet(magnet, config.rdToken);
                    torrentId = added.id;
                }
                catch (addErr) {
                    if (addErr.message && (addErr.message.includes('451') || addErr.message.includes('infringing_file'))) {
                        logger.warn({ infoHash: cleanHash }, 'Torrent hash blocked by Real-Debrid DMCA (451)');
                        await this.cache.set(CacheManager.getRdAvailabilityKey(cleanHash), false, 86400 * 30);
                    }
                    throw addErr;
                }
            }
            // 4. Retrieve torrent info
            let info = await this.rdClient.getTorrentInfo(torrentId, config.rdToken);
            // Parse target season & episode if available
            let targetSeason;
            let targetEpisode;
            if (mediaType === 'series' && mediaId) {
                const parts = mediaId.split(':');
                if (parts[1])
                    targetSeason = parseInt(parts[1], 10);
                if (parts[2])
                    targetEpisode = parseInt(parts[2], 10);
            }
            // Identify video files
            const videoExts = ['.mkv', '.mp4', '.avi', '.ts', '.m4v', '.webm', '.flv'];
            const videoFiles = (info.files || []).filter((f) => videoExts.some((ext) => f.path.toLowerCase().endsWith(ext)));
            // Find the specific file matching target episode (or largest video file for movies)
            let targetFile;
            if (targetSeason !== undefined && targetEpisode !== undefined && videoFiles.length > 0) {
                const sxePattern = new RegExp(`[sS]0?${targetSeason}[eE]0?${targetEpisode}\\b`, 'i');
                const altPattern = new RegExp(`(?:0?${targetSeason}x0?${targetEpisode}|[eE]0?${targetEpisode})\\b`, 'i');
                targetFile = videoFiles.find((f) => sxePattern.test(f.path)) || videoFiles.find((f) => altPattern.test(f.path));
            }
            if (!targetFile && videoFiles.length > 0) {
                // Fallback: pick the largest video file
                const sorted = [...videoFiles].sort((a, b) => b.bytes - a.bytes);
                targetFile = sorted[0];
            }
            // 5. Select target file if needed
            if (info.status === 'waiting_files_selection') {
                const selection = targetFile ? String(targetFile.id) : fileIdx > 0 ? String(fileIdx) : 'all';
                await this.rdClient.selectFiles(torrentId, selection, config.rdToken);
                // Poll up to 4 times (every 300ms) for RD to finish processing/caching
                for (let attempt = 0; attempt < 4; attempt++) {
                    await new Promise((r) => setTimeout(r, 300));
                    info = await this.rdClient.getTorrentInfo(torrentId, config.rdToken);
                    if (info.status === 'downloaded' && info.links && info.links.length > 0) {
                        break;
                    }
                }
            }
            if (!info.links || info.links.length === 0) {
                logger.warn({ infoHash: cleanHash, status: info.status }, 'No download links generated on RD');
                return null;
            }
            // 6. Map target file to the exact link in info.links
            let targetIdx = 0;
            if (targetFile) {
                const selectedFiles = (info.files || []).filter((f) => f.selected === 1);
                const matchIdx = selectedFiles.findIndex((f) => f.id === targetFile.id);
                if (matchIdx !== -1 && matchIdx < info.links.length) {
                    targetIdx = matchIdx;
                }
            }
            else if (fileIdx > 0) {
                targetIdx = Math.min(fileIdx - 1, info.links.length - 1);
            }
            const targetLink = info.links[targetIdx] || info.links[0];
            const unrestricted = await this.rdClient.unrestrictLink(targetLink, config.rdToken);
            if (unrestricted && unrestricted.download) {
                // Cache resolved download URL for 4 hours (14400s)
                await this.cache.set(streamKey, unrestricted.download, 14400);
                return unrestricted.download;
            }
            return null;
        }
        catch (err) {
            logger.error({ infoHash: cleanHash, error: err.message }, 'Failed to resolve stream link');
            return null;
        }
    }
}
