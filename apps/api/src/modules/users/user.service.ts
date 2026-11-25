import type { User } from '@jobpilot/db';
import type { OnboardingInput, UpdateProfileInput } from '@jobpilot/types/schemas';

import { BadRequestError } from '../../shared/errors';

import { fetchClerkProfile } from './clerk-profile';
import { userRepository } from './user.repository';

const stripUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

export const userService = {
  /**
   * Resolve the app user for an authenticated Clerk id. The Clerk webhook normally creates
   * the row; if it hasn't (local dev, a fresh deploy without webhooks), provision it from
   * Clerk on first use so a signed-in student never dead-ends on "User not found".
   */
  async getByClerkId(clerkId: string): Promise<User> {
    return (
      (await userRepository.findByClerkId(clerkId)) ??
      userRepository.upsertFromClerk(await fetchClerkProfile(clerkId))
    );
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
