import { UserButton } from '@clerk/nextjs';
import type { ExperienceLevel } from '@jobpilot/types';
import { redirect } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiServer, ApiServerError } from '@/lib/api-server';

import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

interface MeResponse {
  id: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  experienceLevel: ExperienceLevel | null;
  skills: string[];
  preferredRoles: string[];
  resumeUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  onboardedAt: string | null;
}

export default async function SettingsPage() {
  let me: MeResponse;
  try {
    me = await apiServer<MeResponse>('/users/me');
  } catch (err) {
    if (err instanceof ApiServerError && err.status === 404) redirect('/onboarding');
    throw err;
  }

  if (!me.onboardedAt) redirect('/onboarding');

  return (
    <main className="container max-w-3xl space-y-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile + preferences.</p>
        </div>
        <UserButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Updates apply immediately to AI matching + recommendations.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm
            defaults={{
              name: me.name ?? '',
              bio: me.bio ?? '',
              location: me.location ?? '',
              experienceLevel: me.experienceLevel ?? 'MID',
              skills: me.skills,
              preferredRoles: me.preferredRoles,
              resumeUrl: me.resumeUrl,
              githubUrl: me.githubUrl,
              linkedinUrl: me.linkedinUrl,
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
