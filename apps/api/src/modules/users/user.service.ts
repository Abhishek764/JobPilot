import type { User } from '@jobpilot/db';
import type { OnboardingInput, UpdateProfileInput } from '@jobpilot/types/schemas';

import { BadRequestError, NotFoundError } from '../../shared/errors';

import { userRepository } from './user.repository';

const stripUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

export const userService = {
  async getByClerkId(clerkId: string): Promise<User> {
    const user = await userRepository.findByClerkId(clerkId);
    if (!user) throw new NotFoundError('User');
    return user;
  },

  ensureByClerkId: userRepository.findByClerkId,
  upsertFromClerk: userRepository.upsertFromClerk,
  deleteByClerkId: userRepository.deleteByClerkId,

  async updateProfile(clerkId: string, input: UpdateProfileInput): Promise<User> {
    const user = await userService.getByClerkId(clerkId);
    return userRepository.updateProfile(user.id, stripUndefined(input));
  },

  async completeOnboarding(clerkId: string, input: OnboardingInput): Promise<User> {
    const user = await userService.getByClerkId(clerkId);
    if (user.onboardedAt) throw new BadRequestError('User already onboarded');
    return userRepository.completeOnboarding(user.id, stripUndefined(input));
  },
};
