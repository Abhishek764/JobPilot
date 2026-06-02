import type { ApplicationNote } from '@jobpilot/db';
import type { CreateNoteInput, UpdateNoteInput } from '@jobpilot/types/schemas';

import { emitToUser } from '../../realtime/gateway';
import { NotFoundError } from '../../shared/errors';

import { applicationRepository } from './application.repository';
import { applicationService } from './application.service';
import { noteRepository } from './note.repository';

export const noteService = {
  async list(clerkUserId: string, applicationId: string): Promise<ApplicationNote[]> {
    await applicationService.get(clerkUserId, applicationId);
    return noteRepository.list(applicationId);
  },

  async create(
    clerkUserId: string,
    applicationId: string,
    input: CreateNoteInput,
  ): Promise<ApplicationNote> {
    await applicationService.get(clerkUserId, applicationId);
    const note = await noteRepository.create(applicationId, input.body);
    await applicationRepository.recordEvent(applicationId, 'NOTE_ADDED', { noteId: note.id });
    emitToUser(clerkUserId, 'application.updated', { id: applicationId });
    return note;
  },

  async update(
    clerkUserId: string,
    applicationId: string,
    id: string,
    input: UpdateNoteInput,
  ): Promise<void> {
    await applicationService.get(clerkUserId, applicationId);
    const result = await noteRepository.update(applicationId, id, input.body);
    if (result.count === 0) throw new NotFoundError('Note');
    await applicationRepository.recordEvent(applicationId, 'NOTE_UPDATED', { noteId: id });
    emitToUser(clerkUserId, 'application.updated', { id: applicationId });
  },

  async delete(clerkUserId: string, applicationId: string, id: string): Promise<void> {
    await applicationService.get(clerkUserId, applicationId);
    const result = await noteRepository.delete(applicationId, id);
    if (result.count === 0) throw new NotFoundError('Note');
    await applicationRepository.recordEvent(applicationId, 'NOTE_DELETED', { noteId: id });
    emitToUser(clerkUserId, 'application.updated', { id: applicationId });
  },
};
