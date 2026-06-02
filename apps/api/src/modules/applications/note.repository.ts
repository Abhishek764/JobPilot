import { prisma, type ApplicationNote, type Prisma } from '@jobpilot/db';

export const noteRepository = {
  list: (applicationId: string): Promise<ApplicationNote[]> =>
    prisma.applicationNote.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    }),

  create: (applicationId: string, body: string): Promise<ApplicationNote> =>
    prisma.applicationNote.create({ data: { applicationId, body } }),

  update: (applicationId: string, id: string, body: string): Promise<Prisma.BatchPayload> =>
    prisma.applicationNote.updateMany({ where: { id, applicationId }, data: { body } }),

  delete: (applicationId: string, id: string): Promise<Prisma.BatchPayload> =>
    prisma.applicationNote.deleteMany({ where: { id, applicationId } }),
};
