'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useResumes } from '@/features/resumes/hooks';

import { MATCH_TRACKS, isMatchPending, type MatchTrack } from '../api';
import { useLatestMatchForJob, useMatch, useStartMatch } from '../hooks';

import { MatchBreakdown } from './match-breakdown';

const TRACK_LABEL: Record<MatchTrack, string> = {
  BACKEND: 'Backend',
  FRONTEND: 'Frontend',
  FULLSTACK: 'Full-stack',
  DEVOPS: 'DevOps / Infra',
};

/** Best-effort default from the job's own data; the student can always change it. */
const guessTrack = (title: string, roleCategory: string | null): MatchTrack => {
  const s = `${title} ${roleCategory ?? ''}`.toLowerCase();
  if (/devops|sre|infra|platform|cloud/.test(s)) return 'DEVOPS';
  if (/front|ui|react|web/.test(s)) return 'FRONTEND';
  if (/back|api|server/.test(s)) return 'BACKEND';
  return 'FULLSTACK';
};

export const MatchPanel = ({
  job,
}: {
  job: { id: string; title: string; roleCategory: string | null; description: string | null };
}) => {
  const resumes = useResumes();
  const latest = useLatestMatchForJob(job.id);
  const start = useStartMatch();

  const parsed = resumes.data?.items.filter((r) => r.fileStatus === 'PARSED') ?? [];
  const [resumeId, setResumeId] = useState('');
  const [track, setTrack] = useState<MatchTrack>(() => guessTrack(job.title, job.roleCategory));
  const [activeId, setActiveId] = useState<string | null>(null);

  const firstParsedId = parsed[0]?.id;
  useEffect(() => {
    if (!resumeId && firstParsedId) setResumeId(firstParsedId);
  }, [firstParsedId, resumeId]);
  useEffect(() => {
    if (!activeId && latest.data) setActiveId(latest.data.id);
  }, [latest.data, activeId]);

  const match = useMatch(activeId);
  const analysis = match.data;
  const pending = analysis ? isMatchPending(analysis.status) : false;

  const run = () =>
    start.mutate({ resumeId, jobId: job.id, track }, { onSuccess: (created) => setActiveId(created.id) });

  return (
    <section aria-labelledby="fit-h" className="space-y-4 rounded-xl border border-border bg-card/70 p-5">
      <div>
        <h2 id="fit-h" className="font-semibold tracking-tight">
          Your fit for this role
        </h2>
        <p className="text-xs text-muted-foreground">Compares your resume with this job description.</p>
      </div>

      {!job.description ? (
        <p className="text-sm text-muted-foreground">
          This listing has no description, so there’s nothing reliable to compare against.
        </p>
      ) : resumes.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : resumes.isError ? (
        <div role="alert" className="text-sm">
          <p>Couldn’t load your resumes.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void resumes.refetch()}>
            Try again
          </Button>
        </div>
      ) : parsed.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Upload a resume in the{' '}
          <Link href="/resume" className="text-primary underline-offset-4 hover:underline">
            Resume Lab
          </Link>{' '}
          first. Once it’s parsed you can analyze your fit here.
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="grid gap-2">
            <label className="text-xs font-medium" htmlFor="match-resume">
              Resume
            </label>
            <Select id="match-resume" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
              {parsed.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
            <label className="text-xs font-medium" htmlFor="match-track">
              Role track
            </label>
            <Select id="match-track" value={track} onChange={(e) => setTrack(e.target.value as MatchTrack)}>
              {MATCH_TRACKS.map((t) => (
                <option key={t} value={t}>
                  {TRACK_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full" loading={start.isPending} disabled={!resumeId || pending}>
            {analysis ? 'Re-analyze my fit' : 'Analyze my fit'}
          </Button>
          {start.isError && (
            <p role="alert" className="text-sm text-rose-300">
              {start.error.message}
            </p>
          )}
        </form>
      )}

      {match.isPending && activeId ? (
        <Skeleton className="h-40 w-full" />
      ) : analysis ? (
        <div className="border-t border-border pt-4" aria-live="polite">
          {pending ? (
            <div className="space-y-2 text-sm">
              <p>
                <span aria-hidden className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                {analysis.status === 'QUEUED' ? 'Queued — starting shortly…' : 'Analyzing your resume against this job…'}
              </p>
              <Button size="sm" variant="ghost" onClick={() => void match.refetch()}>
                Refresh
              </Button>
            </div>
          ) : analysis.status === 'FAILED' ? (
            <div role="alert" className="space-y-2 text-sm">
              <p className="text-rose-300">The analysis failed{analysis.error ? `: ${analysis.error}` : '.'}</p>
              <Button size="sm" variant="outline" disabled={!resumeId} onClick={run} loading={start.isPending}>
                Retry
              </Button>
            </div>
          ) : (
            <MatchBreakdown match={analysis} />
          )}
        </div>
      ) : null}
    </section>
  );
};
