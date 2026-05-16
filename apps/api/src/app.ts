import compression from 'compression';
import cors from 'cors';
import express, { type Application } from 'express';
import helmet from 'helmet';

import { env } from './config/env';
import { clerk } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { apiRateLimit } from './middleware/rate-limit';
import { requestContext } from './middleware/request-context';
import { requestLogger } from './middleware/request-logger';
import { clerkWebhookRouter } from './modules/webhooks/clerk.webhook';
import { healthRouter } from './routes/health';
import { v1Router } from './routes/v1';

export const createApp = (): Application => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );
  app.use(compression());

  // Webhooks: raw body so signature verification works. Mount BEFORE json parser.
  app.use('/webhooks', express.raw({ type: 'application/json' }), (req, _res, next) => {
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      try {
        req.body = JSON.parse(req.body.toString('utf8'));
      } catch {
        // leave as-is; webhook handlers can reject
      }
    }
    next();
  }, clerkWebhookRouter);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(requestContext);
  app.use(requestLogger);
  app.use(apiRateLimit);
  app.use(clerk);

  app.use('/health', healthRouter);
  app.use(`/api/${env.API_VERSION}`, v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
