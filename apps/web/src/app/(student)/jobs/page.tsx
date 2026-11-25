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
          Real listings from Remotive, Arbeitnow, LinkedIn, Wellfound, Indeed and Naukri.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-11 w-full" />}>
        <JobSearch />
      </Suspense>
    </div>
  );
}
