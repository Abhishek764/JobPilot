import {
  CreateReminderSchema,
  ListRemindersQuerySchema,
  UpdateReminderSchema,
} from '@jobpilot/types/schemas';
import { Router } from 'express';

import { validate } from '../../middleware/validate';

import { reminderController } from './reminder.controller';

// mergeParams so the parent :id (applicationId) is available here.
export const reminderRouter: Router = Router({ mergeParams: true });

reminderRouter.get('/', validate(ListRemindersQuerySchema, 'query'), reminderController.list);
reminderRouter.post('/', validate(CreateReminderSchema), reminderController.create);
reminderRouter.patch('/:reminderId', validate(UpdateReminderSchema), reminderController.update);
reminderRouter.delete('/:reminderId', reminderController.remove);
