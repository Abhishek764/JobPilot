import {
  BoardQuerySchema,
  CreateApplicationSchema,
  ListApplicationsQuerySchema,
  ListEventsQuerySchema,
  MoveApplicationSchema,
  UpdateApplicationSchema,
  UpdateStatusSchema,
} from '@jobpilot/types/schemas';
import { Router } from 'express';

import { attachUserId, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

import { applicationController } from './application.controller';
import { noteRouter } from './note.routes';
import { reminderRouter } from './reminder.routes';

export const applicationRouter: Router = Router();

applicationRouter.use(requireAuth, attachUserId);

applicationRouter.get('/board', validate(BoardQuerySchema, 'query'), applicationController.board);
applicationRouter.get('/', validate(ListApplicationsQuerySchema, 'query'), applicationController.list);
applicationRouter.post('/', validate(CreateApplicationSchema), applicationController.create);

applicationRouter.get('/:id', applicationController.get);
applicationRouter.patch('/:id', validate(UpdateApplicationSchema), applicationController.update);
applicationRouter.delete('/:id', applicationController.remove);

applicationRouter.patch('/:id/move', validate(MoveApplicationSchema), applicationController.move);
applicationRouter.patch('/:id/status', validate(UpdateStatusSchema), applicationController.updateStatus);
applicationRouter.get(
  '/:id/events',
  validate(ListEventsQuerySchema, 'query'),
  applicationController.events,
);

applicationRouter.use('/:id/notes', noteRouter);
applicationRouter.use('/:id/reminders', reminderRouter);
