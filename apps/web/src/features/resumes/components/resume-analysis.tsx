'use client';

import { isStalePending, type ResumeAnalysis } from '@jobpilot/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { dashboardKeys } from '@/features/dashboard/api';
import { useToken } from '@/lib/use-token';
import { cn } from '@/lib/utils';

import { resumeKeys, resumesApi, type ResumeDetail } from '../api';

const tone = (n: number | null) =>
  n == null
    ? 'text-muted-foreground'
    : n >= 80
      ? 'text-emerald-400'
      : n >= 60
        ? 'text-amber-300'
        : 'text-rose-300';

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

const Score = ({ label, value }: { label: string; value: number | null }) => (
  <div className="border-border rounded-lg border p-3 text-center">
    <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
    <p className={cn('mt-1 text-2xl font-semibold tabular-nums', tone(value))}>{value ?? '—'}</p>
  </div>
);

const Result = ({ a }: { a: ResumeAnalysis }) => {
  const suggestions = [...(a.suggestions ?? [])].sort(
    (x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity],
  );
  const failed = (a.atsIssues ?? []).filter((i) => !i.passed);
  return (
    <div className="space-y-4">
      <div className={cn('grid gap-2', a.keywordScore == null ? 'grid-cols-2' : 'grid-cols-3')}>
        <Score label="Overall" value={a.overallScore} />
        <Score label="ATS" value={a.atsScore} />
        {a.keywordScore != null && <Score label="Keywords" value={a.keywordScore} />}
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            What to change
          </h4>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={`${i}-${s.section}`} className="border-border rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {s.section}{' '}
                  <span className="text-muted-foreground text-xs font-normal">· {s.severity}</span>
                </p>
                <p className="text-muted-foreground">{s.issue}</p>
                <p className="mt-1">{s.recommendation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            ATS checks to fix
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {failed.map((i, n) => (
              <li key={`${n}-${i.check}`}>
                <span className="font-medium">{i.check}:</span> {i.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.missingKeywords.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">Missing keywords:</span> {a.missingKeywords.join(', ')}
        </p>
      )}
      {a.strengths.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">Strengths:</span> {a.strengths.join(' · ')}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        AI review of your resume text only — use it as feedback, not a verdict. Analyzed{' '}
        {new Date(a.updatedAt).toLocaleString()}.
      </p>
    </div>
  );
};

/** Run an ATS/recruiter-style review of a parsed resume and show the latest result. */
export const ResumeAnalysisPanel = ({ resume }: { resume: ResumeDetail }) => {
  const token = useToken();
  const qc = useQueryClient();
  const [jd, setJd] = useState('');
  const latest = resume.analyses[0];
  const pending = latest?.status === 'QUEUED' || latest?.status === 'RUNNING';
  const blocked = pending && latest ? !isStalePending(latest.updatedAt) : false;

  const run = useMutation({
    mutationFn: async () =>
      resumesApi.analyze(await token(), resume.id, jd.trim() ? { jobDescription: jd.trim() } : {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: resumeKeys.detail(resume.id) });
      void qc.invalidateQueries({ queryKey: dashboardKeys.summary });
    },
  });

  return (
    <section className="space-y-3" aria-labelledby="analysis-h">
      <h2
        id="analysis-h"
        className="text-muted-foreground text-sm font-medium uppercase tracking-wide"
      >
        Resume health
      </h2>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          run.mutate();
        }}
      >
        <Textarea
          aria-label="Optional job description"
          rows={3}
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Optional: paste a job description to also check keyword coverage (50+ characters)."
        />
        <Button type="submit" size="sm" loading={run.isPending} disabled={blocked}>
          {latest ? 'Analyze again' : 'Analyze resume'}
        </Button>
        {run.isError && (
          <p role="alert" className="text-sm text-rose-300">
            {run.error.message}
          </p>
        )}
      </form>

      {latest &&
        (pending ? (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            <span
              aria-hidden
              className="bg-primary mr-2 inline-block h-2 w-2 animate-pulse rounded-full"
            />
            Reviewing your resume…
          </p>
        ) : latest.status === 'FAILED' ? (
          <p role="alert" className="text-sm text-rose-300">
            The analysis failed{latest.error ? `: ${latest.error}` : '.'} Try again.
          </p>
        ) : (
          <Result a={latest} />
        ))}
    </section>
  );
};
