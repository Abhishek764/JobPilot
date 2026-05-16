import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import { env } from '../config/env';
import { redis } from '../config/redis';

export const apiRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<unknown>,
    prefix: 'rl:api:',
  }),
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests' },
  },
});
