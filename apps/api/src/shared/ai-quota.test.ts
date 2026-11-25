import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock calls are hoisted above these imports.
import { assertAiQuota } from './ai-quota';
import { RateLimitError } from './errors';

const prisma = vi.hoisted(() => ({ matchAnalysis: { count: vi.fn() } }));
vi.mock('@jobpilot/db', () => ({ prisma }));
vi.mock('../config/env', () => ({ env: { AI_JOBS_PER_HOUR: 3 } }));

describe('assertAiQuota', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  beforeEach(() => vi.resetAllMocks());

  it('allows a user under the hourly cap and counts only their last hour', async () => {
    prisma.matchAnalysis.count.mockResolvedValue(2);
    await expect(assertAiQuota('matchAnalysis', 'user_1', now)).resolves.toBeUndefined();
    expect(prisma.matchAnalysis.count).toHaveBeenCalledWith({
      where: { userId: 'user_1', createdAt: { gte: new Date('2026-11-25T11:00:00Z') } },
    });
  });

  it('rejects with 429 once the cap is reached', async () => {
    prisma.matchAnalysis.count.mockResolvedValue(3);
    await expect(assertAiQuota('matchAnalysis', 'user_1', now)).rejects.toBeInstanceOf(
      RateLimitError,
    );
  });
});
