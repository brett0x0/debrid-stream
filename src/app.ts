import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

import { env } from './config/env.js';
import { decodeUserConfig, encodeUserConfig, userConfigSchema } from './config/userConfig.js';
import { ManifestBuilder } from './stremio/manifest.js';
import { StreamHandler } from './stremio/streamHandler.js';
import { ResolveHandler } from './stremio/resolveHandler.js';
import { ProviderOrchestrator } from './providers/orchestrator.js';
import { safeFetch } from './providers/httpClient.js';

// All Provider Adapters
import { YtsAdapter } from './providers/adapters/yts.js';
import { EztvAdapter } from './providers/adapters/eztv.js';
import { ThePirateBayAdapter } from './providers/adapters/tpb.js';
import { TorrentGalaxyAdapter } from './providers/adapters/torrentGalaxy.js';
import { LeetxAdapter } from './providers/adapters/leetx.js';
import { KickassAdapter } from './providers/adapters/kickass.js';
import { RarbgAdapter } from './providers/adapters/rarbg.js';
import { NyaaAdapter } from './providers/adapters/nyaa.js';
import { TokyoToshoAdapter } from './providers/adapters/tokyotosho.js';
import { AniDexAdapter } from './providers/adapters/anidex.js';
import { MagnetDlAdapter } from './providers/adapters/magnetdl.js';
import { RutorAdapter } from './providers/adapters/rutor.js';
import { RutrackerAdapter } from './providers/adapters/rutracker.js';
import { Torrent9Adapter } from './providers/adapters/torrent9.js';
import { MejorTorrentAdapter } from './providers/adapters/mejortorrent.js';
import { CinecalidadAdapter } from './providers/adapters/cinecalidad.js';

import { RealDebridClient } from './debrid/realDebridClient.js';
import { defaultCache } from './cache/cacheManager.js';
import { logger } from './observability/logger.js';
import { metrics } from './observability/metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildApp() {
  const app = fastify({
    loggerInstance: logger,
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
    routerOptions: {
      maxParamLength: 2048,
    },
  });

  // Register CORS
  app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Register Static files for Configure Web UI
  const publicPath = path.join(__dirname, '../public');
  app.register(fastifyStatic, {
    root: publicPath,
    prefix: '/public/',
  });

  // Initialize all 16 providers
  const providers = [
    new YtsAdapter(),
    new EztvAdapter(),
    new RarbgAdapter(),
    new LeetxAdapter(),
    new ThePirateBayAdapter(),
    new KickassAdapter(),
    new TorrentGalaxyAdapter(),
    new MagnetDlAdapter(),
    new NyaaAdapter(),
    new TokyoToshoAdapter(),
    new AniDexAdapter(),
    new RutorAdapter(),
    new RutrackerAdapter(),
    new Torrent9Adapter(),
    new MejorTorrentAdapter(),
    new CinecalidadAdapter(),
  ];

  const orchestrator = new ProviderOrchestrator(providers);
  const rdClient = new RealDebridClient(env.RD_REQUEST_TIMEOUT_MS);
  const streamHandler = new StreamHandler(orchestrator, rdClient, defaultCache, env.ADDON_URL);
  const resolveHandler = new ResolveHandler(rdClient, defaultCache);

  // Hook for request tracking
  app.addHook('onRequest', async (_req, _reply) => {
    metrics.incrementTotal();
  });

  // Health check endpoint
  app.get('/health', async (_req, reply) => {
    const providerHealth = await orchestrator.getHealthReport();
    return reply.send({
      status: 'ok',
      version: ManifestBuilder.ADDON_VERSION,
      timestamp: new Date().toISOString(),
      metrics: metrics.getMetrics(),
      providers: providerHealth,
    });
  });

  // Configuration Web UI redirect
  app.get('/', async (_req, reply) => {
    return reply.redirect('/configure');
  });

  app.get('/configure', async (_req, reply) => {
    return reply.sendFile('index.html');
  });

  app.get('/:config/configure', async (_req, reply) => {
    return reply.sendFile('index.html');
  });

  // API to validate Real-Debrid API token from Web UI
  app.post('/api/validate-token', async (req, reply) => {
    const body = req.body as { token?: string };
    if (!body || !body.token) {
      return reply.status(400).send({ ok: false, error: 'Token is required' });
    }

    try {
      const user = await rdClient.getUser(body.token.trim());
      return reply.send({
        ok: true,
        user: {
          username: user.username,
          type: user.type,
          points: user.points,
          expiration: user.expiration,
        },
      });
    } catch (err: any) {
      return reply.status(401).send({
        ok: false,
        error: err.message || 'Invalid Real-Debrid API token',
      });
    }
  });

  // API to encode user configuration into a shareable addon manifest URL
  app.post('/api/encode-config', async (req, reply) => {
    try {
      const validated = userConfigSchema.parse(req.body);
      const encoded = encodeUserConfig(validated, true);
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
      const proto = (req.headers['x-forwarded-proto'] as string) || (req.protocol.startsWith('http') ? req.protocol : 'https');
      const baseUrl = host && !host.includes('localhost')
        ? `${proto}://${host}`
        : env.ADDON_URL.replace(/\/+$/, '');

      const manifestUrl = `${baseUrl}/${encoded}/manifest.json`;
      const stremioInstallUrl = manifestUrl.replace(/^https?:\/\//, 'stremio://');

      return reply.send({
        ok: true,
        encoded,
        manifestUrl,
        stremioInstallUrl,
      });
    } catch (err: any) {
      return reply.status(400).send({
        ok: false,
        error: err.message || 'Invalid configuration parameters',
      });
    }
  });

  // API to decode user configuration when loading configure page for editing
  app.get('/api/decode-config/:config', async (req, reply) => {
    const { config } = req.params as { config: string };
    const decoded = decodeUserConfig(config);
    if (!decoded) {
      return reply.status(400).send({ ok: false, error: 'Invalid configuration payload' });
    }
    return reply.send({ ok: true, config: decoded });
  });

  // Debug upstream fetch test
  app.get('/api/debug-fetch', async (req, reply) => {
    const { url } = req.query as { url?: string };
    if (!url) return reply.status(400).send({ error: 'Missing url query param' });
    const t0 = Date.now();
    try {
      const res = await safeFetch(url);
      const text = await res.text();
      return reply.send({
        status: res.status,
        statusText: res.statusText,
        durationMs: Date.now() - t0,
        headers: Object.fromEntries(res.headers.entries()),
        bodySnippet: text.substring(0, 1000),
      });
    } catch (err: any) {
      return reply.status(500).send({
        error: err.message,
        durationMs: Date.now() - t0,
      });
    }
  });

  // Debug provider search test
  app.get('/api/debug-provider', async (req, reply) => {
    const { name, q, season, episode } = req.query as { name?: string; q?: string; season?: string; episode?: string };
    const p = orchestrator.getProvider(name || 'tpb');
    if (!p) return reply.status(404).send({ error: 'Provider not found' });
    const t0 = Date.now();
    try {
      const s = season ? parseInt(season, 10) : 1;
      const e = episode ? parseInt(episode, 10) : 3;
      const meta = {
        type: 'series' as const,
        imdbId: 'tt0903747',
        title: q || 'Breaking Bad',
        season: s,
        episode: e,
      };
      const results = await p.searchSeries(meta);
      return reply.send({
        provider: p.name,
        query: `${meta.title} S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`,
        durationMs: Date.now() - t0,
        count: results.length,
        firstThree: results.slice(0, 3),
      });
    } catch (err: any) {
      return reply.status(500).send({
        provider: p.name,
        error: err.message,
        durationMs: Date.now() - t0,
      });
    }
  });

  // Stremio: Root unconfigured manifest
  app.get('/manifest.json', async (_req, reply) => {
    reply.header('Cache-Control', 'max-age=86400, public');
    return reply.send(ManifestBuilder.buildUnconfigured());
  });

  // Stremio: Configured manifest
  app.get('/:config/manifest.json', async (req, reply) => {
    const { config } = req.params as { config: string };
    const userConfig = decodeUserConfig(config);

    if (!userConfig) {
      return reply.status(400).send({ error: 'Invalid configuration payload' });
    }

    reply.header('Cache-Control', 'max-age=86400, public');
    return reply.send(ManifestBuilder.buildConfigured(userConfig));
  });

  // Stremio: Stream endpoint
  app.get('/:config/stream/:type/:id.json', async (req, reply) => {
    metrics.incrementStream();
    const { config, type, id } = req.params as {
      config: string;
      type: string;
      id: string;
    };

    req.log.info({ type, id }, 'Received stream request');

    if (type !== 'movie' && type !== 'series') {
      return reply.send({ streams: [] });
    }

    const userConfig = decodeUserConfig(config);
    if (!userConfig) {
      return reply.status(401).send({ error: 'Invalid or expired addon configuration' });
    }

    try {
      const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
      const proto = (req.headers['x-forwarded-proto'] as string) || (req.protocol.startsWith('http') ? req.protocol : 'https');
      const baseUrlOverride = host && !host.includes('localhost') ? `${proto}://${host}` : undefined;

      const result = await streamHandler.getStreams(type, id, userConfig, config, baseUrlOverride);

      reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=1800');
      return reply.send(result);
    } catch (err: any) {
      metrics.incrementErrors();
      req.log.error({ err: err.message }, 'Failed to fetch streams');
      return reply.send({ streams: [] });
    }
  });

  // Stremio: Playback resolution redirect
  app.get('/resolve/:config/:infoHash/:fileIdx', async (req, reply) => {
    metrics.incrementResolve();
    const { config, infoHash, fileIdx } = req.params as {
      config: string;
      infoHash: string;
      fileIdx: string;
    };

    const userConfig = decodeUserConfig(config);
    if (!userConfig) {
      return reply.status(401).send({ error: 'Invalid addon configuration' });
    }

    const idx = parseInt(fileIdx, 10) || 0;
    const { type, id } = req.query as { type?: string; id?: string };
    const streamUrl = await resolveHandler.resolve(userConfig, infoHash, idx, type, id);

    if (!streamUrl) {
      return reply.status(404).send({ error: 'Stream not found or could not be resolved' });
    }

    // Redirect user to direct Real-Debrid CDN stream URL
    return reply.redirect(streamUrl, 302);
  });

  return app;
}
