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
    async resolve(config, infoHash, fileIdx = 0) {
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
                const added = await this.rdClient.addMagnet(magnet, config.rdToken);
                torrentId = added.id;
            }
            // 4. Retrieve torrent info
            let info = await this.rdClient.getTorrentInfo(torrentId, config.rdToken);
            // 5. Select target file if needed
            if (info.status === 'waiting_files_selection') {
                const selection = fileIdx > 0 ? String(fileIdx) : 'all';
                await this.rdClient.selectFiles(torrentId, selection, config.rdToken);
                info = await this.rdClient.getTorrentInfo(torrentId, config.rdToken);
            }
            if (!info.links || info.links.length === 0) {
                logger.warn({ infoHash: cleanHash, status: info.status }, 'No download links generated on RD');
                return null;
            }
            // 6. Unrestrict the target link (target file index or first link)
            const targetIdx = Math.min(fileIdx > 0 ? fileIdx - 1 : 0, info.links.length - 1);
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
