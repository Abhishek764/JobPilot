'use client';

import type { Application, Job } from '@jobpilot/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { applicationsApi } from '@/features/applications/api';
import { applicationKeys } from '@/features/applications/keys';
import { MatchPanel } from '@/features/matches/components/match-panel';
import { useToken } from '@/lib/use-token';

import { formatPosted, formatSalary, platformLabel } from '../format';
import { useJob } from '../hooks';

const toApplication = (job: Job, status: 'SAVED' | 'APPLIED'): Partial<Application> => ({
  jobId: job.id,
  company: job.company,
  title: job.title,
  location: job.location,
  status,
  source: platformLabel(job.sourcePlatform),
  url: job.applyUrl,
  salaryMin: job.salaryMin,
  salaryMax: job.salaryMax,
  currency: job.currency,
  ...(status === 'APPLIED' && { appliedAt: new Date() }),
});

const TrackActions = ({ job }: { job: Job }) => {
  const token = useToken();
  const qc = useQueryClient();
  const [tracked, setTracked] = useState<Application | null>(null);
  const track = useMutation({
    mutationFn: async (status: 'SAVED' | 'APPLIED') =>
      applicationsApi.create(await token(), toApplication(job, status)),
    onSuccess: (app) => {
      setTracked(app);
      void qc.invalidateQueries({ queryKey: applicationKeys.all });
    },
  });

  if (tracked) {
    return (
      <div
        className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm"
        role="status"
      >
        Added to your board as <strong>{tracked.status === 'APPLIED' ? 'Applied' : 'Saved'}</strong>
        .{' '}
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href={`/applications?open=${tracked.id}`}
        >
          Open in Applications
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={job.applyUrl} target="_blank" rel="noopener noreferrer">
            Apply on {platformLabel(job.sourcePlatform)} ↗
          </a>
        </Button>
        <Button
          variant="outline"
          loading={track.isPending && track.variables === 'SAVED'}
          disabled={track.isPending}
          onClick={() => track.mutate('SAVED')}
        >
          Save to board
        </Button>
        <Button
          variant="secondary"
          loading={track.isPending && track.variables === 'APPLIED'}
          disabled={track.isPending}
          onClick={() => track.mutate('APPLIED')}
        >
          I applied
        </Button>
      </div>
      {track.isError && (
        <p role="alert" className="text-sm text-red-400">
          Couldn’t add this job: {track.error.message}
        </p>
      )}
    </div>
  );
};

export const JobDetail = ({ id }: { id: string }) => {
  const { data: job, isPending, isError, error, refetch } = useJob(id);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/5 p-6 text-sm">
        <p className="font-medium">Couldn’t load this job.</p>
        <p className="text-muted-foreground mt-1">{error.message}</p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/jobs">Back to jobs</Link>
          </Button>
        </div>
      </div>
    );
  }

  const salary = formatSalary(job);

  return (
    <article className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{platformLabel(job.sourcePlatform)}</Badge>
            {job.remote && <Badge variant="secondary">Remote</Badge>}
            {!job.isActive && <Badge variant="destructive">No longer listed</Badge>}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{job.title}</h1>
          <p className="text-muted-foreground text-lg">{job.company}</p>
          <dl className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div>
              <dt className="sr-only">Location</dt>
              <dd>{job.location ?? 'Location not listed'}</dd>
            </div>
            <div>
              <dt className="sr-only">Posted</dt>
              <dd>{formatPosted(job.postedAt)}</dd>
            </div>
            {salary && (
              <div>
                <dt className="sr-only">Salary</dt>
                <dd className="text-foreground font-medium">{salary}</dd>
              </div>
            )}
          </dl>
        </header>

        <TrackActions job={job} />

        {job.skills.length > 0 && (
          <section aria-labelledby="skills-h">
            <h2
              id="skills-h"
              className="text-muted-foreground mb-2 text-sm font-medium uppercase tracking-wide"
            >
              Skills listed
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {job.skills.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="desc-h">
          <h2
            id="desc-h"
            className="text-muted-foreground mb-2 text-sm font-medium uppercase tracking-wide"
          >
            Description
          </h2>
          {job.description ? (
            <div className="text-foreground/90 whitespace-pre-line text-sm leading-relaxed">
              {job.description}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              The source didn’t include a description. Open the original posting for full details.
            </p>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <MatchPanel job={job} />
      </aside>
    </article>
  );
};
