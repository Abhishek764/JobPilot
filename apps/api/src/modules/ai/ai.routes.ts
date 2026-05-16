import { AnalyzeResumeSchema } from '@jobpilot/types/schemas';
import { Router } from 'express';

import { attachUserId, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

import { aiController } from './ai.controller';

export const aiRouter: Router = Router();

aiRouter.use(requireAuth, attachUserId);
aiRouter.post('/analyze-resume', validate(AnalyzeResumeSchema), aiController.analyzeResume);
