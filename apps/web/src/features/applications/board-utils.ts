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

/** Status dot colours: muted, low-saturation tones that stay distinguishable. */
export const COLUMN_ACCENT: Record<BoardColumnStatus, string> = {
  SAVED: 'bg-slate-400',
  APPLIED: 'bg-[#7FA6D4]',
  OA: 'bg-[#CDB37A]',
  INTERVIEW: 'bg-[#86B8C7]',
  OFFER: 'bg-[#8CBF9C]',
  REJECTED: 'bg-[#CF8C8C]',
};

export const columnDroppableId = (status: string): string => `col:${status}`;
export const isColumnId = (id: string): boolean => id.startsWith('col:');
export const statusFromColumnId = (id: string): string => id.slice('col:'.length);
