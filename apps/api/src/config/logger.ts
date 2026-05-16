import { createLogger } from '@jobpilot/logger';

import { env } from './env';

export const logger = createLogger('api', { level: env.LOG_LEVEL });
