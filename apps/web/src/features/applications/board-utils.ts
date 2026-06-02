import type { BoardColumnStatus } from '@jobpilot/types';

/** Spacing left between cards so a drop between two neighbours stays exact. */
export const POSITION_STEP = 1024;

/** Pick a fractional position for a card dropped between two neighbours. */
export const positionBetween = (prev?: number, next?: number): number => {
  if (prev == null && next == null) return POSITION_STEP;
  if (prev == null) return next! - POSITION_STEP;
  if (next == null) return prev + POSITION_STEP;
  return (prev + next) / 2;
};

export const COLUMN_ACCENT: Record<BoardColumnStatus, string> = {
  SAVED: 'border-t-slate-400',
  APPLIED: 'border-t-blue-500',
  OA: 'border-t-amber-500',
  INTERVIEW: 'border-t-violet-500',
  OFFER: 'border-t-emerald-500',
  REJECTED: 'border-t-rose-500',
};

export const columnDroppableId = (status: string): string => `col:${status}`;
export const isColumnId = (id: string): boolean => id.startsWith('col:');
export const statusFromColumnId = (id: string): string => id.slice('col:'.length);
