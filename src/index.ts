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
  } catch (err) {
    logger.error(err, 'Failed to start DebridStream server');
    process.exit(1);
  }
}

main();
