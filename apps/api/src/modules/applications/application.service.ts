import type { Application, ApplicationEvent } from '@jobpilot/db';
import {
  APPLICATION_STATUSES,
  type ApplicationInsights,
  type ApplicationStatus,
  type Board,
  type PaginatedResult,
} from '@jobpilot/types';
import type {
  BoardQuery,
  CreateApplicationInput,
  ListApplicationsQuery,
  ListEventsQuery,
  MoveApplicationInput,
  UpdateApplicationInput,
  UpdateStatusInput,
} from '@jobpilot/types/schemas';

import { emitToUser } from '../../realtime/gateway';
import { NotFoundError } from '../../shared/errors';
import { userService } from '../users/user.service';

import { applicationRepository } from './application.repository';

/** Gap left between adjacent cards so a drop between two neighbours stays exact. */
const POSITION_STEP = 1024;

const resolveUserId = async (clerkUserId: string): Promise<string> => {
  const user = await userService.getByClerkId(clerkUserId);
  return user.id;
};

const ensureOwned = async (userId: string, id: string): Promise<Application> => {
  const app = await applicationRepository.findById(userId, id);
  if (!app) throw new NotFoundError('Application');
  return app;
};

export const applicationService = {
  async list(clerkUserId: string, query: ListApplicationsQuery): Promise<PaginatedResult<Application>> {
    const userId = await resolveUserId(clerkUserId);
    return applicationRepository.list(userId, query);
  },

  async board(clerkUserId: string, query: BoardQuery): Promise<Board> {
    const userId = await resolveUserId(clerkUserId);
    return applicationRepository.board(userId, query);
  },

  async get(clerkUserId: string, id: string): Promise<Application> {
    const userId = await resolveUserId(clerkUserId);
    return ensureOwned(userId, id);
  },

  async create(clerkUserId: string, input: CreateApplicationInput): Promise<Application> {
    const userId = await resolveUserId(clerkUserId);
    const status = input.status ?? 'SAVED';
    const max = await applicationRepository.maxPosition(userId, status);
    const position = (max ?? 0) + POSITION_STEP;

    const created = await applicationRepository.create(userId, { ...input, position });
    emitToUser(clerkUserId, 'application.created', created);
    return created;
  },

  async update(clerkUserId: string, id: string, input: UpdateApplicationInput): Promise<Application> {
    const userId = await resolveUserId(clerkUserId);
    const result = await applicationRepository.update(userId, id, input);
    if (result.count === 0) throw new NotFoundError('Application');

    const updated = await applicationRepository.findById(userId, id);
    if (!updated) throw new NotFoundError('Application');

    await applicationRepository.recordEvent(id, 'UPDATED', { fields: Object.keys(input) });
    emitToUser(clerkUserId, 'application.updated', updated);
    return updated;
  },

  /** Drag-and-drop move: explicit target status + fractional position. */
  async move(clerkUserId: string, id: string, input: MoveApplicationInput): Promise<Application> {
    const userId = await resolveUserId(clerkUserId);
    const moved = await applicationRepository.move(userId, id, input.status, input.position);
    if (!moved) throw new NotFoundError('Application');
    emitToUser(clerkUserId, 'application.moved', moved);
    return moved;
  },

  /** Status change without an explicit position — appends to the target column. */
  async updateStatus(clerkUserId: string, id: string, input: UpdateStatusInput): Promise<Application> {
    const userId = await resolveUserId(clerkUserId);
    await ensureOwned(userId, id);
    const max = await applicationRepository.maxPosition(userId, input.status);
    const moved = await applicationRepository.move(userId, id, input.status, (max ?? 0) + POSITION_STEP);
    if (!moved) throw new NotFoundError('Application');
    emitToUser(clerkUserId, 'application.moved', moved);
    return moved;
  },

  async delete(clerkUserId: string, id: string): Promise<void> {
    const userId = await resolveUserId(clerkUserId);
    const result = await applicationRepository.delete(userId, id);
    if (result.count === 0) throw new NotFoundError('Application');
    emitToUser(clerkUserId, 'application.deleted', { id });
  },

  async insights(clerkUserId: string, now: Date = new Date()): Promise<ApplicationInsights> {
    const userId = await resolveUserId(clerkUserId);
    const raw = await applicationRepository.insights(userId, now);
    const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
      ApplicationStatus,
      number
    >;
    for (const { status, count } of raw.byStatus) byStatus[status as ApplicationStatus] = count;
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    return { total, byStatus, upcomingReminders: raw.upcomingReminders, recentActivity: raw.recentActivity };
  },

  async listEvents(
    clerkUserId: string,
    id: string,
    query: ListEventsQuery,
  ): Promise<PaginatedResult<ApplicationEvent>> {
    const userId = await resolveUserId(clerkUserId);
    await ensureOwned(userId, id);
    return applicationRepository.listEvents(id, query);
  },
};
