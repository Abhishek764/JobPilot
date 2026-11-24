/** Pending work (queued/parsing/running) that hasn't moved for this long is treated as stuck. */
export const STALE_PENDING_MS = 10 * 60_000;

/** True when a pending record's last update is older than the threshold, so a retry is safe to offer. */
export const isStalePending = (
  updatedAt: Date | string,
  now: number = Date.now(),
  thresholdMs: number = STALE_PENDING_MS,
): boolean => now - new Date(updatedAt).getTime() > thresholdMs;
