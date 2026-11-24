import Link from 'next/link';

import { JobDetail } from '@/features/jobs/components/job-detail';

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-muted-foreground hover:text-foreground text-sm">
        ← All jobs
      </Link>
      <JobDetail id={id} />
    </div>
  );
}
