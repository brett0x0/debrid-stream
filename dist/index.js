import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './observability/logger.js';
async function main() {
    const app = buildApp();
    try {
        const address = await app.listen({
            port: env.PORT,
            host: env.HOST,
        });
        logger.info(`DebridStream server listening at ${address}`);
        logger.info(`Configure URL: ${address}/configure`);
        logger.info(`Manifest URL: ${address}/manifest.json`);
        // Keep-alive heartbeat for Render Free tier to prevent container sleep
        const keepAliveUrl = process.env.RENDER_EXTERNAL_URL
            ? `${process.env.RENDER_EXTERNAL_URL}/health`
            : (env.ADDON_URL.startsWith('http') && !env.ADDON_URL.includes('localhost') ? `${env.ADDON_URL}/health` : null);
        if (keepAliveUrl) {
            logger.info(`Starting cloud keep-alive heartbeat for ${keepAliveUrl} (every 8 minutes)`);
            setInterval(() => {
                fetch(keepAliveUrl)
                    .then((r) => logger.debug({ status: r.status }, 'Keep-alive ping success'))
                    .catch((e) => logger.warn({ err: e.message }, 'Keep-alive ping warning'));
            }, 8 * 60 * 1000);
        }
    }
    catch (err) {
        logger.error(err, 'Failed to start DebridStream server');
        process.exit(1);
    }
}
main();
