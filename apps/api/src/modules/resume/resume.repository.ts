import { prisma, type Prisma, type Resume } from '@jobpilot/db';
import type { PaginatedResult } from '@jobpilot/types';
import type { ListResumesQuery } from '@jobpilot/types/schemas';

export const resumeRepository = {
  create: (data: Prisma.ResumeUncheckedCreateInput): Promise<Resume> =>
    prisma.resume.create({ data }),

  findById: (userId: string, id: string): Promise<Resume | null> =>
    prisma.resume.findFirst({ where: { id, userId } }),

  findRaw: (id: string): Promise<Resume | null> => prisma.resume.findUnique({ where: { id } }),

  list: async (userId: string, q: ListResumesQuery): Promise<PaginatedResult<Resume>> => {
    const where: Prisma.ResumeWhereInput = { userId };
    const [items, total] = await Promise.all([
      prisma.resume.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.resume.count({ where }),
    ]);
    return {
      items,
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  },

  detail: (userId: string, id: string) =>
    prisma.resume.findFirst({
      where: { id, userId },
      include: {
        analyses: { orderBy: { createdAt: 'desc' }, take: 10 },
        versions: { orderBy: { createdAt: 'desc' }, take: 10 },
        coverLetters: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    }),

  update: (id: string, data: Prisma.ResumeUncheckedUpdateInput): Promise<Resume> =>
    prisma.resume.update({ where: { id }, data }),

  setParsed: (
    id: string,
    data: { content: string; parsedSkills: string[]; parsedYears: number | null },
  ): Promise<Resume> =>
    prisma.resume.update({
      where: { id },
      data: { ...data, fileStatus: 'PARSED', parseError: null },
    }),

  setParseFailed: (id: string, error: string): Promise<Resume> =>
    prisma.resume.update({ where: { id }, data: { fileStatus: 'FAILED', parseError: error } }),

  delete: (userId: string, id: string): Promise<Prisma.BatchPayload> =>
    prisma.resume.deleteMany({ where: { id, userId } }),

  /** Collect every S3 key owned by a resume so they can be cleaned on delete. */
  fileKeys: async (id: string): Promise<string[]> => {
    const [resume, versions, covers] = await Promise.all([
      prisma.resume.findUnique({ where: { id }, select: { fileKey: true } }),
      prisma.resumeVersion.findMany({ where: { resumeId: id }, select: { fileKey: true } }),
      prisma.coverLetter.findMany({ where: { resumeId: id }, select: { fileKey: true } }),
    ]);
    return [
      resume?.fileKey,
      ...versions.map((v) => v.fileKey),
      ...covers.map((c) => c.fileKey),
    ].filter((k): k is string => Boolean(k));
  },
};
