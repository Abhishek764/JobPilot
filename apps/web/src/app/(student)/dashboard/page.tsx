import type { DashboardSummary } from '@jobpilot/types';

import { apiServer } from '@/lib/api-server';

import { DashboardClient } from './dashboard-client';

export const metadata = { title: 'Home · JobPilot AI' };

export default async function DashboardPage() {
  // Server-render the first paint; the client refetches and handles retry on failure.
  let initial: DashboardSummary | undefined;
  try {
    initial = await apiServer<DashboardSummary>('/dashboard/summary');
  } catch {
    initial = undefined;
  }
  return <DashboardClient initial={initial} />;
}
