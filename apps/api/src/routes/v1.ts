import { Router } from 'express';

import { aiRouter } from '../modules/ai/ai.routes';
import { applicationRouter } from '../modules/applications/application.routes';
import { scraperRouter } from '../modules/scraper/scraper.routes';
import { userRouter } from '../modules/users/user.routes';

export const v1Router: Router = Router();

v1Router.use('/users', userRouter);
v1Router.use('/applications', applicationRouter);
v1Router.use('/ai', aiRouter);
v1Router.use('/scrape', scraperRouter);
