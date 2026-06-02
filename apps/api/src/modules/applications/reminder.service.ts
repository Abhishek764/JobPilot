import type { Prisma, Reminder } from '@jobpilot/db';
import type {
  CreateReminderInput,
  ListRemindersQuery,
  UpdateReminderInput,
} from '@jobpilot/types/schemas';

import { emitToUser } from '../../realtime/gateway';
import { NotFoundError } from '../../shared/errors';

import { applicationRepository } from './application.repository';
import { applicationService } from './application.service';
import { reminderRepository } from './reminder.repository';

export const reminderService = {
  async list(
    clerkUserId: string,
    applicationId: string,
    query: ListRemindersQuery,
  ): Promise<Reminder[]> {
    await applicationService.get(clerkUserId, applicationId);
    return reminderRepository.list(applicationId, query);
  },

  async create(
    clerkUserId: string,
    applicationId: string,
    input: CreateReminderInput,
  ): Promise<Reminder> {
    await applicationService.get(clerkUserId, applicationId);
    const reminder = await reminderRepository.create({
      applicationId,
      title: input.title,
      dueAt: input.dueAt,
    });
    await applicationRepository.recordEvent(applicationId, 'REMINDER_ADDED', {
      reminderId: reminder.id,
      dueAt: reminder.dueAt,
    });
    emitToUser(clerkUserId, 'reminder.changed', { applicationId, reminder });
    return reminder;
  },

  async update(
    clerkUserId: string,
    applicationId: string,
    id: string,
    input: UpdateReminderInput,
  ): Promise<Reminder> {
    await applicationService.get(clerkUserId, applicationId);
    const existing = await reminderRepository.findById(applicationId, id);
    if (!existing) throw new NotFoundError('Reminder');

    const data: Prisma.ReminderUncheckedUpdateInput = { ...input };
    const completing = input.status === 'COMPLETED' && existing.status !== 'COMPLETED';
    if (completing) data.completedAt = new Date();
    if (input.status && input.status !== 'COMPLETED') data.completedAt = null;

    await reminderRepository.update(applicationId, id, data);
    const updated = await reminderRepository.findById(applicationId, id);
    if (!updated) throw new NotFoundError('Reminder');

    if (completing) {
      await applicationRepository.recordEvent(applicationId, 'REMINDER_COMPLETED', { reminderId: id });
    }
    emitToUser(clerkUserId, 'reminder.changed', { applicationId, reminder: updated });
    return updated;
  },

  async delete(clerkUserId: string, applicationId: string, id: string): Promise<void> {
    await applicationService.get(clerkUserId, applicationId);
    const result = await reminderRepository.delete(applicationId, id);
    if (result.count === 0) throw new NotFoundError('Reminder');
    await applicationRepository.recordEvent(applicationId, 'REMINDER_DELETED', { reminderId: id });
    emitToUser(clerkUserId, 'reminder.changed', { applicationId, reminderId: id });
  },
};
