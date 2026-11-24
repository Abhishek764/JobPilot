import { Suspense } from 'react';

import { ApplicationsBoard } from '@/features/applications/components/applications-board';

export const metadata = { title: 'Applications · JobPilot AI' };

export default function ApplicationsPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-muted-foreground">Track every opportunity from saved to offer.</p>
      </header>
      <div className="min-h-0 flex-1">
        <Suspense>
          <ApplicationsBoard />
        </Suspense>
      </div>
    </div>
  );
}
