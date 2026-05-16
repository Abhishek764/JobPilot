import { prisma, type Application, type Prisma } from '@jobpilot/db';
import type { PaginatedResult } from '@jobpilot/types';
import type { ListApplicationsQuery } from '@jobpilot/types/schemas';

export const applicationRepository = {
  list: async (userId: string, q: ListApplicationsQuery): Promise<PaginatedResult<Application>> => {
    const where: Prisma.ApplicationWhereInput = {
      userId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { company: { contains: q.search, mode: 'insensitive' } },
              { title: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { [q.sortBy]: q.sortDir },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.application.count({ where }),
    ]);

    return {
      items,
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  },

  findById: (userId: string, id: string): Promise<Application | null> =>
    prisma.application.findFirst({ where: { id, userId } }),

  create: (userId: string, data: Prisma.ApplicationUncheckedCreateInput): Promise<Application> =>
    prisma.application.create({ data: { ...data, userId } }),

  update: (
    userId: string,
    id: string,
    data: Prisma.ApplicationUncheckedUpdateInput,
  ): Promise<Prisma.BatchPayload> =>
    prisma.application.updateMany({ where: { id, userId }, data }),

  delete: (userId: string, id: string): Promise<Prisma.BatchPayload> =>
    prisma.application.deleteMany({ where: { id, userId } }),
};
