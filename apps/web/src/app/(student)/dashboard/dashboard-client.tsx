'use client';

import type { DashboardAttentionItem, DashboardSummary } from '@jobpilot/types';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboardApi, dashboardKeys } from '@/features/dashboard/api';
import { platformLabel } from '@/features/jobs/format';
import { useToken } from '@/lib/use-token';
import { cn } from '@/lib/utils';

const ATTENTION_LABEL: Record<DashboardAttentionItem['kind'], string> = {
  REMINDER: 'Follow-up',
  PARSING: 'Resume',
  MATCH: 'Match',
};

/** Attention links come from our API; still only follow same-origin app paths. */
const safeHref = (href: string) => (href.startsWith('/') && !href.startsWith('//') ? href : '/dashboard');

const scoreTone = (score: number | null) =>
  score == null ? 'text-muted-foreground' : score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-300' : 'text-rose-300';

const Metric = ({ label, value, hint, href }: { label: string; value: string; hint: string; href: string }) => (
  <Link
    href={href}
    className="rise-in rounded-xl border border-border bg-card/70 p-5 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </Link>
);

const SearchHero = () => {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <section className="hero-glow rounded-2xl border border-border p-6 md:p-10" aria-labelledby="hero-h">
      <h1 id="hero-h" className="text-3xl font-semibold tracking-tight md:text-4xl">
        What do you want to work on next?
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Search real listings, then check your fit against your own resume before you apply.
      </p>
      <form
        role="search"
        className="mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const query = q.trim();
          router.push(query ? `/jobs?q=${encodeURIComponent(query)}` : '/jobs');
        }}
      >
        <label htmlFor="hero-q" className="sr-only">
          Search jobs
        </label>
        <Input
          id="hero-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. backend intern, data analyst, React"
          className="h-12 bg-background/60 text-base"
        />
        <Button type="submit" size="lg" className="h-12">
          Search jobs
        </Button>
      </form>
    </section>
  );
};

const SummarySkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading summary">
    {['a', 'b', 'c', 'd'].map((k) => (
      <Skeleton key={k} className="h-28 rounded-xl" />
    ))}
  </div>
);

const Sections = ({ summary }: { summary: DashboardSummary }) => {
  const { metrics, recommendedJobs, attentionItems } = summary;
  return (
    <>
      <section aria-label="Your numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Strong matches" value={String(metrics.strongMatches)} hint="Fit score 80 or higher" href="/jobs" />
        <Metric
          label="Active applications"
          value={String(metrics.activeApplications)}
          hint="Not rejected, withdrawn or ghosted"
          href="/applications"
        />
        <Metric
          label="Resume health"
          value={metrics.resumeHealth == null ? 'Not analyzed' : `${metrics.resumeHealth}/100`}
          hint={metrics.resumeHealth == null ? 'Upload and analyze a resume' : 'Latest completed analysis'}
          href="/resume"
        />
        <Metric
          label="Pending actions"
          value={String(metrics.pendingActions)}
          hint="Follow-ups due within 7 days"
          href="/applications"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="rec-h" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="rec-h" className="text-lg font-semibold tracking-tight">
              Your best recent matches
            </h2>
            <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">
              Browse all jobs →
            </Link>
          </div>
          {recommendedJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
              No match analyses yet. Open any job and choose <strong className="text-foreground">Analyze my fit</strong>{' '}
              to see how your resume lines up.
            </div>
          ) : (
            <ul className="space-y-2">
              {recommendedJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{job.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {job.company}
                        {job.location ? ` · ${job.location}` : ''} · {platformLabel(job.sourcePlatform)}
                      </p>
                    </div>
                    <span className={cn('shrink-0 text-xl font-semibold tabular-nums', scoreTone(job.compatibility))}>
                      {job.compatibility ?? '—'}
                      <span className="sr-only"> fit score</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="att-h" className="space-y-3">
          <h2 id="att-h" className="text-lg font-semibold tracking-tight">
            Needs your attention
          </h2>
          {attentionItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-sm text-muted-foreground">
              You’re all caught up.
            </div>
          ) : (
            <ul className="space-y-2">
              {attentionItems.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={safeHref(item.href)}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card/70 p-3 text-sm transition-colors hover:border-primary/50"
                  >
                    <Badge variant="outline" className="shrink-0">
                      {ATTENTION_LABEL[item.kind]}
                    </Badge>
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};

export const DashboardClient = ({ initial }: { initial?: DashboardSummary }) => {
  const token = useToken();
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: async () => dashboardApi.summary(await token()),
    initialData: initial,
  });

  return (
    <div className="space-y-8">
      <SearchHero />
      {isPending ? (
        <SummarySkeleton />
      ) : isError ? (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/5 p-6 text-sm">
          <p className="font-medium">Couldn’t load your summary.</p>
          <p className="mt-1 text-muted-foreground">{error.message}</p>
          <Button className="mt-4" size="sm" variant="outline" loading={isRefetching} onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <Sections summary={data} />
      )}
    </div>
  );
};
