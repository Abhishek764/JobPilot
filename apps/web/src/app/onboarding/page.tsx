import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { apiServer, ApiServerError } from '@/lib/api-server';

import { OnboardingForm } from './onboarding-form';

interface MeResponse {
  id: string;
  name: string | null;
  onboardedAt: string | null;
}

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const clerk = await currentUser();
  if (!clerk) redirect('/sign-in');

  let me: MeResponse | null = null;
  try {
    me = await apiServer<MeResponse>('/users/me');
  } catch (err) {
    if (!(err instanceof ApiServerError) || err.status !== 404) throw err;
  }

  if (me?.onboardedAt) redirect('/dashboard');

  const fallbackName = [clerk.firstName, clerk.lastName].filter(Boolean).join(' ') || undefined;

  return (
    <main className="container flex min-h-screen items-center justify-center py-10">
      <OnboardingForm defaultName={me?.name ?? fallbackName} />
    </main>
  );
}
