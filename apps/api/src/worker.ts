import { prisma } from '@jobpilot/db';

import { startBackground } from './background';
import { logger } from './config/logger';
import { redis } from './config/redis';
import { stopWorkers } from './modules/queue';
import { closeBrowser } from './modules/scraper/browser';

const main = async (): Promise<void> => {
  const workers = await startBackground();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'worker shutdown');
    const timeout = setTimeout(() => {
      logger.error('forced worker shutdown after 15s');
      process.exit(1);
    }, 15_000);
    try {
      await stopWorkers(workers);
      await closeBrowser();
      await redis.quit();
      await prisma.$disconnect();
    } catch (err) {
      logger.error({ err }, 'worker shutdown error');
    } finally {
      clearTimeout(timeout);
      process.exit(0);
    }
  };

  (['SIGINT', 'SIGTERM'] as const).forEach((sig) => process.on(sig, () => void shutdown(sig)));
};

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
});

void main();
