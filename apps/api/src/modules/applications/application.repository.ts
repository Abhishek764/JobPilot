import {
  prisma,
  type Application,
  type ApplicationEvent,
  type ApplicationEventType,
  type Prisma,
} from '@jobpilot/db';
import type { Board, PaginatedResult } from '@jobpilot/types';
import { BOARD_COLUMNS } from '@jobpilot/types';
import type { BoardQuery, ListApplicationsQuery, ListEventsQuery } from '@jobpilot/types/schemas';

const searchFilter = (search?: string): Prisma.ApplicationWhereInput =>
  search
    ? {
        OR: [
          { company: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

export const applicationRepository = {
  list: async (userId: string, q: ListApplicationsQuery): Promise<PaginatedResult<Application>> => {
    const where: Prisma.ApplicationWhereInput = {
      userId,
      ...(q.status ? { status: q.status } : {}),
      ...searchFilter(q.search),
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

  /** All board-column applications for a user, grouped and ordered by position. */
  board: async (userId: string, q: BoardQuery): Promise<Board> => {
    const where: Prisma.ApplicationWhereInput = {
      userId,
      status: { in: [...BOARD_COLUMNS] },
      ...(q.source ? { source: q.source } : {}),
      ...searchFilter(q.search),
    };

    const rows = await prisma.application.findMany({
      where,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    const byStatus = new Map<string, Application[]>(BOARD_COLUMNS.map((s) => [s, []]));
    for (const row of rows) byStatus.get(row.status)?.push(row);

    return {
      columns: BOARD_COLUMNS.map((status) => {
        const items = byStatus.get(status) ?? [];
        return { status, total: items.length, items };
      }),
    };
  },

  findById: (userId: string, id: string): Promise<Application | null> =>
    prisma.application.findFirst({ where: { id, userId } }),

  /** Largest position currently used in a column, or null when empty. */
  maxPosition: async (userId: string, status: Application['status']): Promise<number | null> => {
    const top = await prisma.application.findFirst({
      where: { userId, status },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return top?.position ?? null;
  },

  create: (
    userId: string,
    data: Omit<Prisma.ApplicationUncheckedCreateInput, 'userId'>,
  ): Promise<Application & { events: ApplicationEvent[] }> =>
    prisma.application.create({
      data: {
        ...data,
        userId,
        events: { create: { type: 'CREATED', payload: { status: data.status ?? 'SAVED' } } },
      },
      include: { events: true },
    }),

  update: (
    userId: string,
    id: string,
    data: Prisma.ApplicationUncheckedUpdateInput,
  ): Promise<Prisma.BatchPayload> => prisma.application.updateMany({ where: { id, userId }, data }),

  /**
   * Move a card to a status/position and log the change atomically. Returns the
   * updated row, or null when the application does not belong to the user.
   */
  move: async (
    userId: string,
    id: string,
    status: Application['status'],
    position: number,
  ): Promise<Application | null> =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.application.findFirst({ where: { id, userId } });
      if (!existing) return null;

      const updated = await tx.application.update({
        where: { id },
        data: { status, position },
      });

      const statusChanged = existing.status !== status;
      await tx.applicationEvent.create({
        data: {
          applicationId: id,
          type: statusChanged ? 'STATUS_CHANGED' : 'MOVED',
          payload: statusChanged
            ? { from: existing.status, to: status, position }
            : { status, position },
        },
      });

      return updated;
    }),

  delete: (userId: string, id: string): Promise<Prisma.BatchPayload> =>
    prisma.application.deleteMany({ where: { id, userId } }),

  /** Raw aggregates for the insights panel; every query is scoped by userId. */
  insights: async (userId: string, now: Date) => {
    const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [groups, upcomingReminders, events] = await Promise.all([
      prisma.application.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
      prisma.reminder.count({
        where: { application: { userId }, status: 'PENDING', dueAt: { lte: horizon } },
      }),
      prisma.applicationEvent.findMany({
        where: { application: { userId } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          type: true,
          createdAt: true,
          applicationId: true,
          application: { select: { company: true, title: true } },
        },
      }),
    ]);
    return {
      byStatus: groups.map((g) => ({ status: g.status, count: g._count._all })),
      upcomingReminders,
      recentActivity: events.map((e) => ({
        id: e.id,
        type: e.type,
        createdAt: e.createdAt,
        applicationId: e.applicationId,
        company: e.application.company,
        title: e.application.title,
      })),
    };
  },

  jobExists: async (jobId: string): Promise<boolean> =>
    (await prisma.job.count({ where: { id: jobId } })) > 0,

  recordEvent: (
    applicationId: string,
    type: ApplicationEventType,
    payload?: Prisma.InputJsonValue,
  ): Promise<ApplicationEvent> =>
    prisma.applicationEvent.create({ data: { applicationId, type, payload } }),

  listEvents: async (
    applicationId: string,
    q: ListEventsQuery,
  ): Promise<PaginatedResult<ApplicationEvent>> => {
    const where = { applicationId };
    const [items, total] = await Promise.all([
      prisma.applicationEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.applicationEvent.count({ where }),
    ]);
    return {
      items,
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  },
};
