import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { ApplicationsBoard } from '@/features/applications/components/applications-board';
import { apiServer, ApiServerError } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

interface MeResponse {
  onboardedAt: string | null;
}

export default async function ApplicationsPage() {
  const clerk = await currentUser();
  if (!clerk) redirect('/sign-in');

  let me: MeResponse | null = null;
  try {
    me = await apiServer<MeResponse>('/users/me');
  } catch (err) {
    if (err instanceof ApiServerError && err.status === 404) redirect('/onboarding');
    throw err;
  }
  if (!me?.onboardedAt) redirect('/onboarding');

  return (
    <main className="flex h-screen flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground">Track every opportunity from saved to offer.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <UserButton />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <ApplicationsBoard />
      </div>
    </main>
  );
}
