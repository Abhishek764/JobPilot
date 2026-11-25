import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestError } from '../../shared/errors';

const repo = vi.hoisted(() => ({
  findByClerkId: vi.fn(),
  upsertFromClerk: vi.fn(),
  completeOnboarding: vi.fn(),
}));
const clerk = vi.hoisted(() => ({ fetchClerkProfile: vi.fn() }));

vi.mock('./user.repository', () => ({ userRepository: repo }));
vi.mock('./clerk-profile', () => clerk);

import { userService } from './user.service';

const input = { name: 'Demo Student', experienceLevel: 'INTERN' } as never;

describe('userService.completeOnboarding', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repo.completeOnboarding.mockImplementation(async (id: string) => ({
      id,
      onboardedAt: new Date(),
    }));
  });

  it('creates the user from Clerk when the webhook has not synced them yet', async () => {
    repo.findByClerkId.mockResolvedValue(null);
    clerk.fetchClerkProfile.mockResolvedValue({
      clerkId: 'clerk_1',
      email: 'student@example.com',
      firstName: 'Demo',
      lastName: 'Student',
      imageUrl: null,
    });
    repo.upsertFromClerk.mockResolvedValue({ id: 'user_1', onboardedAt: null });

    await userService.completeOnboarding('clerk_1', input);

    expect(clerk.fetchClerkProfile).toHaveBeenCalledWith('clerk_1');
    expect(repo.upsertFromClerk).toHaveBeenCalledWith(
      expect.objectContaining({ clerkId: 'clerk_1', email: 'student@example.com' }),
    );
    expect(repo.completeOnboarding).toHaveBeenCalledWith('user_1', expect.anything());
  });

  it('getByClerkId provisions on any first authenticated request (e.g. /users/me)', async () => {
    repo.findByClerkId.mockResolvedValue(null);
    clerk.fetchClerkProfile.mockResolvedValue({
      clerkId: 'clerk_2',
      email: 'new@example.com',
      firstName: null,
      lastName: null,
      imageUrl: null,
    });
    repo.upsertFromClerk.mockResolvedValue({ id: 'user_2' });
    await expect(userService.getByClerkId('clerk_2')).resolves.toEqual({ id: 'user_2' });
  });

  it('does not call Clerk for a user that already exists', async () => {
    repo.findByClerkId.mockResolvedValue({ id: 'user_1', onboardedAt: null });
    await userService.completeOnboarding('clerk_1', input);
    expect(clerk.fetchClerkProfile).not.toHaveBeenCalled();
  });

  it('still refuses to onboard twice', async () => {
    repo.findByClerkId.mockResolvedValue({ id: 'user_1', onboardedAt: new Date() });
    await expect(userService.completeOnboarding('clerk_1', input)).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });
});
