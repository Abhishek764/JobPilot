import { prisma } from '@jobpilot/db';

import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { redis } from './config/redis';
import { closeBrowser } from './modules/scraper/browser';

const app = createApp();

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(
    { port: env.API_PORT, host: env.API_HOST, env: env.NODE_ENV },
    `🚀 API listening on http://${env.API_HOST}:${env.API_PORT}`,
  );
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutdown signal received');
  server.close(() => logger.info('http server closed'));

  const timeout = setTimeout(() => {
    logger.error('forced shutdown after 10s');
    process.exit(1);
  }, 10_000);

  try {
    await closeBrowser();
    await redis.quit();
    await prisma.$disconnect();
  } catch (err) {
    logger.error({ err }, 'shutdown error');
  } finally {
    clearTimeout(timeout);
    process.exit(0);
  }
};

(['SIGINT', 'SIGTERM'] as const).forEach((sig) => process.on(sig, () => void shutdown(sig)));

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
});
