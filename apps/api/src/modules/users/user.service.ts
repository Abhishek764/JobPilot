import type { User } from '@jobpilot/db';

import { NotFoundError } from '../../shared/errors';

import { userRepository } from './user.repository';

export const userService = {
  async getByClerkId(clerkId: string): Promise<User> {
    const user = await userRepository.findByClerkId(clerkId);
    if (!user) throw new NotFoundError('User');
    return user;
  },

  ensureByClerkId: userRepository.findByClerkId,
  upsertFromClerk: userRepository.upsertFromClerk,
  deleteByClerkId: userRepository.deleteByClerkId,
};
