import { CreateNoteSchema, UpdateNoteSchema } from '@jobpilot/types/schemas';
import { Router } from 'express';

import { validate } from '../../middleware/validate';

import { noteController } from './note.controller';

// mergeParams so the parent :id (applicationId) is available here.
export const noteRouter: Router = Router({ mergeParams: true });

noteRouter.get('/', noteController.list);
noteRouter.post('/', validate(CreateNoteSchema), noteController.create);
noteRouter.patch('/:noteId', validate(UpdateNoteSchema), noteController.update);
noteRouter.delete('/:noteId', noteController.remove);
