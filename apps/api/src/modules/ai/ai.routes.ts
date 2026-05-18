import {
  AnalyzeResumeSchema,
  CreateMatchAnalysisSchema,
  ListMatchAnalysesQuerySchema,
} from '@jobpilot/types/schemas';
import { Router } from 'express';

import { attachUserId, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

import { aiController } from './ai.controller';
import { matchController } from './match.controller';

export const aiRouter: Router = Router();

aiRouter.use(requireAuth, attachUserId);
aiRouter.post('/analyze-resume', validate(AnalyzeResumeSchema), aiController.analyzeResume);

aiRouter.post('/match', validate(CreateMatchAnalysisSchema), matchController.create);
aiRouter.get('/match', validate(ListMatchAnalysesQuerySchema, 'query'), matchController.list);
aiRouter.get('/match/:id', matchController.get);
