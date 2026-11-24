import type { Job, PaginatedResult, SourcePlatform } from '@jobpilot/types';

import { apiFetch } from '@/lib/api-client';

export interface JobFilters {
  q?: string;
  platform?: SourcePlatform;
  location?: string;
  remote?: boolean;
  skills?: string[];
  page?: number;
  pageSize?: number;
}

/** Serialize filters to a query string, dropping empty values. */
export const toQuery = (filters: JobFilters): string => {
  const sp = new URLSearchParams();
  const q = filters.q?.trim();
  if (q) sp.set('q', q);
  if (filters.platform) sp.set('platform', filters.platform);
  const location = filters.location?.trim();
  if (location) sp.set('location', location);
  if (filters.remote !== undefined) sp.set('remote', String(filters.remote));
  const skills = filters.skills?.map((s) => s.trim()).filter(Boolean);
  if (skills?.length) sp.set('skills', skills.join(','));
  if (filters.page && filters.page > 1) sp.set('page', String(filters.page));
  if (filters.pageSize) sp.set('pageSize', String(filters.pageSize));
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const jobsApi = {
  list: (token: string | null, filters: JobFilters): Promise<PaginatedResult<Job>> =>
    apiFetch<PaginatedResult<Job>>(`/jobs${toQuery(filters)}`, { token }),
  get: (token: string | null, id: string): Promise<Job> => apiFetch<Job>(`/jobs/${id}`, { token }),
};

export const jobKeys = {
  all: ['jobs'] as const,
  list: (filters: JobFilters) => ['jobs', 'list', filters] as const,
  detail: (id: string) => ['jobs', id] as const,
};
