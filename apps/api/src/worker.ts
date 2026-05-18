import { prisma } from '@jobpilot/db';

import { env } from './config/env';
import { logger } from './config/logger';
import { redis } from './config/redis';
import { startAllWorkers, stopWorkers, syncScheduledSources } from './modules/queue';
import { closeBrowser } from './modules/scraper/browser';
import { registerScrapers } from './modules/scraper/sources';

const main = async (): Promise<void> => {
  registerScrapers();
  const workers = startAllWorkers();

  if (env.SCRAPER_SCHEDULER_ENABLED) {
    await syncScheduledSources().catch((err) =>
      logger.error({ err }, 'initial scheduler sync failed'),
    );
  }

  logger.info(
    { count: workers.length, schedulerEnabled: env.SCRAPER_SCHEDULER_ENABLED },
    '👷 workers started',
  );

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
