'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useMatchesForResume } from '../hooks';

/** Recent job matches run with one resume, linking back to each job's full breakdown. */
export const ResumeMatches = ({ resumeId }: { resumeId: string }) => {
  const { data, isPending, isError, refetch } = useMatchesForResume(resumeId);
  return (
    <section aria-labelledby="rm-h" className="space-y-3 rounded-xl border border-border bg-card/70 p-5">
      <h2 id="rm-h" className="font-semibold tracking-tight">
        Job matches
      </h2>
      {isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : isError ? (
        <div role="alert" className="text-sm">
          Couldn’t load matches.{' '}
          <Button size="sm" variant="ghost" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matches yet.{' '}
          <Link href="/jobs" className="text-primary underline-offset-4 hover:underline">
            Find a job
          </Link>{' '}
          and choose “Analyze my fit”.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((m) => (
            <li key={m.id}>
              {m.jobId ? (
                <Link
                  href={`/jobs/${m.jobId}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-primary/50"
                >
                  <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                  <span className="font-medium tabular-nums">
                    {m.status === 'COMPLETED' ? `${m.compatibility ?? '—'} fit` : m.status.toLowerCase()}
                  </span>
                </Link>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <span>Pasted job · {new Date(m.createdAt).toLocaleDateString()}</span>
                  <span className="font-medium tabular-nums">
                    {m.status === 'COMPLETED' ? `${m.compatibility ?? '—'} fit` : m.status.toLowerCase()}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
