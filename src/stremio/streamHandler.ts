import crypto from 'crypto';
import { StremioStreamResponse, StremioStream } from './types.js';
import { UserConfig } from '../config/userConfig.js';
import { CinemetaClient } from '../metadata/cinemeta.js';
import { ProviderOrchestrator } from '../providers/orchestrator.js';
import { RealDebridClient } from '../debrid/realDebridClient.js';
import { CacheManager } from '../cache/cacheManager.js';
import { StreamRanker } from '../ranking/ranker.js';
import { TorrentCandidate } from '../parser/types.js';
import { logger } from '../observability/logger.js';

export class StreamHandler {
  private cinemeta: CinemetaClient;
  private orchestrator: ProviderOrchestrator;
  private rdClient: RealDebridClient;
  private cache: CacheManager;
  private publicBaseUrl: string;

  constructor(
    orchestrator: ProviderOrchestrator,
    rdClient: RealDebridClient,
    cache: CacheManager,
    publicBaseUrl: string
  ) {
    this.orchestrator = orchestrator;
    this.rdClient = rdClient;
    this.cache = cache;
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, '');
    this.cinemeta = new CinemetaClient();
  }

  public async getStreams(
    type: 'movie' | 'series',
    id: string,
    config: UserConfig,
    encodedConfig: string,
    baseUrlOverride?: string
  ): Promise<StremioStreamResponse> {
    const configHash = crypto.createHash('md5').update(JSON.stringify(config)).digest('hex').slice(0, 10);
    const fullStreamKey = CacheManager.getFullStreamKey(type, id, configHash);

    // 0. Check full stream response cache (instant sub-millisecond return)
    const cachedResponse = await this.cache.get<StremioStreamResponse>(fullStreamKey);
    if (cachedResponse && cachedResponse.streams && cachedResponse.streams.length > 0) {
      if (baseUrlOverride) {
        return {
          streams: cachedResponse.streams.map((s) => ({
            ...s,
            url: s.url ? s.url.replace(/^https?:\/\/[^/]+/, baseUrlOverride) : s.url,
          })),
        };
      }
      return cachedResponse;
    }

    // 1. Resolve media metadata from Cinemeta
    const meta = await this.cinemeta.resolve(type, id);
    if (!meta) {
      logger.warn({ type, id }, 'Failed to resolve Cinemeta metadata');
      return { streams: [] };
    }

    logger.info({ type, id, title: meta.title, season: meta.season, episode: meta.episode }, 'Cinemeta resolved');

    // 2. Fetch candidates from L3 provider cache or search orchestrator
    const provCacheKey = CacheManager.getProviderSearchKey(type, id);
    let candidates = await this.cache.get<TorrentCandidate[]>(provCacheKey);
    if (!candidates || candidates.length === 0) {
      candidates = await this.orchestrator.search(meta, config);
      logger.info({ type, id, candidatesFound: candidates?.length }, 'Orchestrator search completed');
      if (candidates && candidates.length > 0) {
        await this.cache.set(provCacheKey, candidates, 7200);
      }
    } else {
      logger.info({ type, id, cachedCandidates: candidates.length }, 'Using cached provider results');
    }

    if (!candidates || candidates.length === 0) {
      return { streams: [] };
    }

    // 3. Batch check Real-Debrid instant availability
    const hashes = candidates.map((c) => c.infoHash.toLowerCase());
    const cachedHashes = new Set<string>();

    // Check availability in user's personal Real-Debrid library (cached 60s)
    const tokenHash = crypto.createHash('md5').update(config.rdToken).digest('hex').slice(0, 10);
    const userTorrentsKey = CacheManager.getUserTorrentsKey(tokenHash);
    let userTorrents = await this.cache.get<Array<{ id: string; hash: string; status: string }>>(userTorrentsKey);

    if (!userTorrents) {
      try {
        userTorrents = await this.rdClient.getUserTorrents(config.rdToken, 100);
        await this.cache.set(userTorrentsKey, userTorrents, 60); // 60 seconds TTL
      } catch {
        userTorrents = [];
      }
    }

    for (const t of userTorrents) {
      if (t.status === 'downloaded' && t.hash) {
        cachedHashes.add(t.hash.toLowerCase());
      }
    }

    // Check availability in L4 cache first
    const deadHashes = new Set<string>();
    const missingHashes: string[] = [];
    for (const h of hashes) {
      if (cachedHashes.has(h)) continue;
      const availKey = CacheManager.getRdAvailabilityKey(h);
      const isCached = await this.cache.get<boolean>(availKey);
      if (isCached === true) {
        cachedHashes.add(h);
      } else if (isCached === false) {
        deadHashes.add(h);
      } else if (isCached === null) {
        missingHashes.push(h);
      }
    }

    // Filter out known DMCA-blocked/dead hashes if valid alternatives exist
    const validCandidates = candidates.filter((c) => !deadHashes.has(c.infoHash.toLowerCase()));
    const candidatesToRank = validCandidates.length > 0 ? validCandidates : candidates;

    // Check if any candidate in this query is known to be cached
    const hasAnyCached = candidatesToRank.some((c) => cachedHashes.has(c.infoHash.toLowerCase()));

    // 4. Rank candidates deterministically
    const ranked = StreamRanker.rank(candidatesToRank, cachedHashes, config);

    // 5. Format into Stremio stream representations
    const streams: StremioStream[] = ranked.map((item) => {
      const c = item.candidate;
      const p = c.parsed;

      // Quality badge: [RD+] if cached or if instant-availability is unavailable (on-demand resolve)
      const badge = item.isCached || !hasAnyCached ? '[RD+]' : '[RD download]';
      const res = p?.resolution && p.resolution !== 'unknown' ? p.resolution : 'HD';

      // Format file size
      let sizeStr = '';
      if (c.sizeBytes > 0) {
        if (c.sizeBytes >= 1e9) {
          sizeStr = `${(c.sizeBytes / 1e9).toFixed(1)} GB`;
        } else {
          sizeStr = `${Math.round(c.sizeBytes / 1e6)} MB`;
        }
      }

      // Format Stream Name
      const nameParts = [badge, 'DebridStream'];
      const detailParts = [res];
      if (sizeStr) detailParts.push(sizeStr);
      const streamName = `${nameParts.join(' ')}\n${detailParts.join(' | ')}`;

      // Format Stream Title description
      const titleLines: string[] = [c.title];
      const specs: string[] = [];

      if (sizeStr) specs.push(`💾 ${sizeStr}`);
      if (p?.codec && p.codec !== 'unknown') specs.push(`⚙️ ${p.codec}`);
      if (p?.hdr?.dolbyVision) specs.push('✨ DV');
      else if (p?.hdr?.hdr) specs.push('✨ HDR');

      if (p?.audio && p.audio.codec !== 'Unknown') {
        const ch = p.audio.channels !== 'Unknown' ? ` ${p.audio.channels}` : '';
        specs.push(`🔊 ${p.audio.codec}${ch}`);
      }

      if (c.seeders > 0) specs.push(`👥 ${c.seeders}`);
      if (c.provider) specs.push(`🔗 ${c.provider.toUpperCase()}`);

      if (specs.length > 0) {
        titleLines.push(specs.join(' | '));
      }

      // Construct lazy resolution link
      const fileIdx = item.fileIdx ?? 0;
      const baseUrl = baseUrlOverride || this.publicBaseUrl;
      const resolveUrl = `${baseUrl}/resolve/${encodedConfig}/${c.infoHash}/${fileIdx}?type=${type}&id=${encodeURIComponent(id)}`;

      return {
        name: streamName,
        title: titleLines.join('\n'),
        url: resolveUrl,
        behaviorHints: {
          bingeGroup: `debridstream-${res}-${p?.source ?? 'default'}`,
        },
      };
    });

    const result: StremioStreamResponse = { streams };
    if (streams.length > 0) {
      await this.cache.set(fullStreamKey, result, 7200); // 2 hours
    }

    return result;
  }
}
