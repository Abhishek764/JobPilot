import { ListResumesQuerySchema, UploadResumeSchema } from '@jobpilot/types/schemas';
import { Router } from 'express';

import { attachUserId, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

import { resumeController } from './resume.controller';

export const resumeRouter: Router = Router();

resumeRouter.use(requireAuth, attachUserId);

resumeRouter.post('/upload-ticket', validate(UploadResumeSchema), resumeController.createUpload);
resumeRouter.get('/', validate(ListResumesQuerySchema, 'query'), resumeController.list);
resumeRouter.get('/:id', resumeController.get);
resumeRouter.post('/:id/ingest', resumeController.ingest);
resumeRouter.get('/:id/download', resumeController.download);
resumeRouter.delete('/:id', resumeController.remove);
