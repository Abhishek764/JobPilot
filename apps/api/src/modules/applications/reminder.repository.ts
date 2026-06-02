import { prisma, type Prisma, type Reminder } from '@jobpilot/db';
import type { ListRemindersQuery } from '@jobpilot/types/schemas';

export const reminderRepository = {
  list: (applicationId: string, q: ListRemindersQuery): Promise<Reminder[]> =>
    prisma.reminder.findMany({
      where: {
        applicationId,
        ...(q.status ? { status: q.status } : {}),
        ...(q.upcoming ? { status: 'PENDING', dueAt: { gte: new Date() } } : {}),
      },
      orderBy: { dueAt: 'asc' },
      take: q.pageSize,
      skip: (q.page - 1) * q.pageSize,
    }),

  create: (data: Prisma.ReminderUncheckedCreateInput): Promise<Reminder> =>
    prisma.reminder.create({ data }),

  findById: (applicationId: string, id: string): Promise<Reminder | null> =>
    prisma.reminder.findFirst({ where: { id, applicationId } }),

  update: (
    applicationId: string,
    id: string,
    data: Prisma.ReminderUncheckedUpdateInput,
  ): Promise<Prisma.BatchPayload> =>
    prisma.reminder.updateMany({ where: { id, applicationId }, data }),

  delete: (applicationId: string, id: string): Promise<Prisma.BatchPayload> =>
    prisma.reminder.deleteMany({ where: { id, applicationId } }),
};
