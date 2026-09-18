import { UserConfig } from '../config/userConfig.js';
import { RealDebridClient } from '../debrid/realDebridClient.js';
import { CacheManager } from '../cache/cacheManager.js';

export class ResolveHandler {
  private rdClient: RealDebridClient;
  private cache: CacheManager;

  constructor(rdClient: RealDebridClient, cache: CacheManager) {
    this.rdClient = rdClient;
    this.cache = cache;
  }

  /**
   * Resolves an infoHash and file index into a playable Real-Debrid streaming URL.
   */
  public async resolve(
    config: UserConfig,
    infoHash: string,
    fileIdx: number = 0
  ): Promise<string | null> {
    const cleanHash = infoHash.toLowerCase().trim();
    const streamKey = CacheManager.getRdStreamKey(cleanHash, fileIdx);

    // 1. Check L4 stream URL cache
    const cachedUrl = await this.cache.get<string>(streamKey);
    if (cachedUrl) {
      return cachedUrl;
    }

    try {
      // 2. Add magnet to Real-Debrid
      const magnet = `magnet:?xt=urn:btih:${cleanHash}`;
      const added = await this.rdClient.addMagnet(magnet, config.rdToken);

      // 3. Select target file (or all)
      const selection = fileIdx > 0 ? String(fileIdx) : 'all';
      await this.rdClient.selectFiles(added.id, selection, config.rdToken);

      // 4. Retrieve torrent info and links
      const info = await this.rdClient.getTorrentInfo(added.id, config.rdToken);
      if (!info.links || info.links.length === 0) {
        return null;
      }

      // 5. Unrestrict the target link
      const targetLink = info.links[0]!;
      const unrestricted = await this.rdClient.unrestrictLink(targetLink, config.rdToken);

      if (unrestricted && unrestricted.download) {
        // Cache resolved download URL for 4 hours (14400s)
        await this.cache.set(streamKey, unrestricted.download, 14400);
        return unrestricted.download;
      }

      return null;
    } catch {
      return null;
    }
  }
}
