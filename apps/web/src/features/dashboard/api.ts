import type { DashboardSummary } from '@jobpilot/types';

import { apiFetch } from '@/lib/api-client';

export const dashboardApi = {
  summary: (token: string | null) => apiFetch<DashboardSummary>('/dashboard/summary', { token }),
};

export const dashboardKeys = {
  summary: ['dashboard', 'summary'] as const,
};
