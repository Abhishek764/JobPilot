import type { BoardFilters } from './api';

export const applicationKeys = {
  all: ['applications'] as const,
  detail: (id: string) => ['applications', id, 'detail'] as const,
  board: (filters: BoardFilters) => ['applications', 'board', filters] as const,
  events: (id: string) => ['applications', id, 'events'] as const,
  notes: (id: string) => ['applications', id, 'notes'] as const,
  reminders: (id: string) => ['applications', id, 'reminders'] as const,
};
