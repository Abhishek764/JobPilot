import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { JobSearch } from '@/features/jobs/components/job-search';

export const metadata = { title: 'Jobs · JobPilot AI' };

export default function JobsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Find jobs</h1>
        <p className="text-muted-foreground text-sm">
          Internships and entry-level jobs (up to 1.5 years&apos; experience) from public job
          boards, refreshed every hour.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-11 w-full" />}>
        <JobSearch />
      </Suspense>
    </div>
  );
}
