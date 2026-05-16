import type { Application } from '@jobpilot/db';
import type { PaginatedResult } from '@jobpilot/types';
import type {
  CreateApplicationInput,
  ListApplicationsQuery,
  UpdateApplicationInput,
} from '@jobpilot/types/schemas';

import { NotFoundError } from '../../shared/errors';
import { userService } from '../users/user.service';

import { applicationRepository } from './application.repository';

const resolveUserId = async (clerkUserId: string): Promise<string> => {
  const user = await userService.getByClerkId(clerkUserId);
  return user.id;
};

export const applicationService = {
  async list(clerkUserId: string, query: ListApplicationsQuery): Promise<PaginatedResult<Application>> {
    const userId = await resolveUserId(clerkUserId);
    return applicationRepository.list(userId, query);
  },

  async get(clerkUserId: string, id: string): Promise<Application> {
    const userId = await resolveUserId(clerkUserId);
    const app = await applicationRepository.findById(userId, id);
    if (!app) throw new NotFoundError('Application');
    return app;
  },

  async create(clerkUserId: string, input: CreateApplicationInput): Promise<Application> {
    const userId = await resolveUserId(clerkUserId);
    return applicationRepository.create(userId, input);
  },

  async update(clerkUserId: string, id: string, input: UpdateApplicationInput): Promise<Application> {
    const userId = await resolveUserId(clerkUserId);
    const result = await applicationRepository.update(userId, id, input);
    if (result.count === 0) throw new NotFoundError('Application');
    const updated = await applicationRepository.findById(userId, id);
    if (!updated) throw new NotFoundError('Application');
    return updated;
  },

  async delete(clerkUserId: string, id: string): Promise<void> {
    const userId = await resolveUserId(clerkUserId);
    const result = await applicationRepository.delete(userId, id);
    if (result.count === 0) throw new NotFoundError('Application');
  },
};
