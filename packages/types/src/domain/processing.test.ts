import { describe, expect, it } from 'vitest';

import { isStalePending, STALE_PENDING_MS } from './processing';

describe('isStalePending', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');

  it('is false for recently updated work', () => {
    expect(isStalePending(new Date(now - 60_000), now)).toBe(false);
  });

  it('is true once work has not moved for longer than the threshold', () => {
    expect(isStalePending(new Date(now - STALE_PENDING_MS - 1), now)).toBe(true);
    expect(isStalePending(new Date(now - STALE_PENDING_MS - 1).toISOString(), now)).toBe(true);
  });
});
