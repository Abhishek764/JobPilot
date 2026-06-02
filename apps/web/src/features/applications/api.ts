import type {
  Application,
  ApplicationEvent,
  ApplicationNote,
  Board,
  PaginatedResult,
  Reminder,
} from '@jobpilot/types';

import { apiFetch } from '@/lib/api-client';

export interface BoardFilters {
  search?: string;
  source?: string;
}

const qs = (params: Record<string, string | undefined>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const applicationsApi = {
  board: (token: string | null, filters: BoardFilters): Promise<Board> =>
    apiFetch<Board>(`/applications/board${qs({ search: filters.search, source: filters.source })}`, {
      token,
    }),

  get: (token: string | null, id: string): Promise<Application> =>
    apiFetch<Application>(`/applications/${id}`, { token }),

  create: (token: string | null, body: Partial<Application>): Promise<Application> =>
    apiFetch<Application>('/applications', { method: 'POST', body, token }),

  setStatus: (token: string | null, id: string, status: string): Promise<Application> =>
    apiFetch<Application>(`/applications/${id}/status`, { method: 'PATCH', body: { status }, token }),

  update: (token: string | null, id: string, body: Partial<Application>): Promise<Application> =>
    apiFetch<Application>(`/applications/${id}`, { method: 'PATCH', body, token }),

  move: (
    token: string | null,
    id: string,
    body: { status: string; position: number },
  ): Promise<Application> =>
    apiFetch<Application>(`/applications/${id}/move`, { method: 'PATCH', body, token }),

  remove: (token: string | null, id: string): Promise<void> =>
    apiFetch<void>(`/applications/${id}`, { method: 'DELETE', token }),

  events: (token: string | null, id: string): Promise<PaginatedResult<ApplicationEvent>> =>
    apiFetch<PaginatedResult<ApplicationEvent>>(`/applications/${id}/events`, { token }),

  notes: {
    list: (token: string | null, id: string): Promise<ApplicationNote[]> =>
      apiFetch<ApplicationNote[]>(`/applications/${id}/notes`, { token }),
    create: (token: string | null, id: string, body: string): Promise<ApplicationNote> =>
      apiFetch<ApplicationNote>(`/applications/${id}/notes`, { method: 'POST', body: { body }, token }),
    remove: (token: string | null, id: string, noteId: string): Promise<void> =>
      apiFetch<void>(`/applications/${id}/notes/${noteId}`, { method: 'DELETE', token }),
  },

  reminders: {
    list: (token: string | null, id: string): Promise<Reminder[]> =>
      apiFetch<Reminder[]>(`/applications/${id}/reminders`, { token }),
    create: (token: string | null, id: string, body: { title: string; dueAt: string }): Promise<Reminder> =>
      apiFetch<Reminder>(`/applications/${id}/reminders`, { method: 'POST', body, token }),
    complete: (token: string | null, id: string, reminderId: string): Promise<Reminder> =>
      apiFetch<Reminder>(`/applications/${id}/reminders/${reminderId}`, {
        method: 'PATCH',
        body: { status: 'COMPLETED' },
        token,
      }),
    remove: (token: string | null, id: string, reminderId: string): Promise<void> =>
      apiFetch<void>(`/applications/${id}/reminders/${reminderId}`, { method: 'DELETE', token }),
  },
};
