import { Router } from 'express';

import { aiRouter } from '../modules/ai/ai.routes';
import { applicationRouter } from '../modules/applications/application.routes';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes';
import { jobRouter } from '../modules/jobs/job.routes';
import { coverLetterRouter } from '../modules/resume/cover-letter.routes';
import { resumeRouter } from '../modules/resume/resume.routes';
import { scraperRouter } from '../modules/scraper/scraper.routes';
import { userRouter } from '../modules/users/user.routes';

export const v1Router: Router = Router();

v1Router.use('/users', userRouter);
v1Router.use('/applications', applicationRouter);
v1Router.use('/dashboard', dashboardRouter);
v1Router.use('/ai', aiRouter);
v1Router.use('/jobs', jobRouter);
v1Router.use('/resumes', resumeRouter);
v1Router.use('/cover-letters', coverLetterRouter);
v1Router.use('/scrape', scraperRouter);
