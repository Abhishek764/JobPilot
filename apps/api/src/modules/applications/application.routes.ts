import {
  CreateApplicationSchema,
  ListApplicationsQuerySchema,
  UpdateApplicationSchema,
} from '@jobpilot/types/schemas';
import { Router } from 'express';

import { attachUserId, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

import { applicationController } from './application.controller';

export const applicationRouter: Router = Router();

applicationRouter.use(requireAuth, attachUserId);

applicationRouter.get('/', validate(ListApplicationsQuerySchema, 'query'), applicationController.list);
applicationRouter.get('/:id', applicationController.get);
applicationRouter.post('/', validate(CreateApplicationSchema), applicationController.create);
applicationRouter.patch('/:id', validate(UpdateApplicationSchema), applicationController.update);
applicationRouter.delete('/:id', applicationController.remove);
