import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiServer, ApiServerError } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

interface MeResponse {
  id: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  skills: string[];
  preferredRoles: string[];
  experienceLevel: string | null;
  onboardedAt: string | null;
}

export default async function DashboardPage() {
  const clerk = await currentUser();
  if (!clerk) redirect('/sign-in');

  let me: MeResponse | null = null;
  try {
    me = await apiServer<MeResponse>('/users/me');
  } catch (err) {
    if (err instanceof ApiServerError && err.status === 404) {
      redirect('/onboarding');
    }
    throw err;
  }

  if (!me?.onboardedAt) redirect('/onboarding');

  return (
    <main className="container space-y-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back{me.name ? `, ${me.name}` : ''}.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">Settings</Link>
          </Button>
          <UserButton />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>{me.experienceLevel ?? 'Experience not set'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {me.skills.length > 0 ? (
                  me.skills.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No skills yet.</span>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Preferred roles</p>
              <div className="flex flex-wrap gap-1.5">
                {me.preferredRoles.map((r) => (
                  <Badge key={r} variant="outline">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Start tracking opportunities.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/applications/new">Add application</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/settings">Edit profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
