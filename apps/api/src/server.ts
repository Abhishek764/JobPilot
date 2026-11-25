import { createServer } from 'node:http';

import { prisma } from '@jobpilot/db';
import type { Worker } from 'bullmq';

import { createApp } from './app';
import { startBackground } from './background';
import { env } from './config/env';
import { logger } from './config/logger';
import { redis } from './config/redis';
import { stopWorkers } from './modules/queue';
import { closeBrowser } from './modules/scraper/browser';
import { closeRealtime, initRealtime } from './realtime/gateway';

const app = createApp();
const server = createServer(app);

initRealtime(server);

let workers: Worker[] = [];
if (env.RUN_WORKERS) {
  startBackground()
    .then((started) => {
      workers = started;
    })
    .catch((err) => logger.error({ err }, 'in-process workers failed to start'));
}

server.listen(env.API_PORT, env.API_HOST, () => {
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
    await stopWorkers(workers);
    await closeRealtime();
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
