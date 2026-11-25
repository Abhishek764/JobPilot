import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { StudentShell } from '@/components/student/student-shell';
import { apiServer, ApiServerError } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

interface MeResponse {
  name: string | null;
  onboardedAt: string | null;
}

/** Every student route requires a Clerk session and a completed onboarding. */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const clerk = await currentUser();
  if (!clerk) redirect('/sign-in');

  let me: MeResponse | undefined;
  try {
    me = await apiServer<MeResponse>('/users/me');
  } catch (err) {
    if (err instanceof ApiServerError && err.status === 404) redirect('/onboarding');
    throw err;
  }
  if (!me?.onboardedAt) redirect('/onboarding');

  const displayName = me.name ?? clerk.firstName ?? clerk.username ?? 'Student';

  return <StudentShell displayName={displayName}>{children}</StudentShell>;
}
