'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToken } from '@/lib/use-token';

import { isProcessing, resumeKeys, resumesApi, type ResumeDetail as Detail } from '../api';
import { useDeleteResume, useResume } from '../hooks';

import { ResumeProgress } from './resume-status';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
    {children}
  </section>
);

const Actions = ({ resume }: { resume: Detail }) => {
  const token = useToken();
  const qc = useQueryClient();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteResume();

  const download = useMutation({
    mutationFn: async () => resumesApi.downloadUrl(await token(), resume.id),
    onSuccess: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
  });
  const retry = useMutation({
    mutationFn: async () => resumesApi.ingest(await token(), resume.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: resumeKeys.all }),
  });

  const error = download.error ?? retry.error ?? remove.error;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {resume.fileKey && resume.fileStatus !== 'PENDING' && (
          <Button variant="outline" size="sm" loading={download.isPending} onClick={() => download.mutate()}>
            Download PDF
          </Button>
        )}
        {resume.fileStatus === 'FAILED' && resume.fileKey && (
          <Button size="sm" loading={retry.isPending} onClick={() => retry.mutate()}>
            Retry parsing
          </Button>
        )}
        {confirming ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              loading={remove.isPending}
              onClick={() => remove.mutate(resume.id, { onSuccess: () => router.push('/resume') })}
            >
              Delete permanently
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error.message}
        </p>
      )}
    </div>
  );
};

export const ResumeDetailView = ({ id, children }: { id: string; children?: ReactNode }) => {
  const { data: resume, isPending, isError, error, refetch, isFetching } = useResume(id);
  const [showText, setShowText] = useState(false);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/5 p-6 text-sm">
        <p className="font-medium">Couldn’t load this resume.</p>
        <p className="mt-1 text-muted-foreground">{error.message}</p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/resume">Back to Resume Lab</Link>
          </Button>
        </div>
      </div>
    );
  }

  const processing = isProcessing(resume.fileStatus);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">{resume.title}</h1>
          <ResumeProgress status={resume.fileStatus} error={resume.parseError} />
          {processing && (
            <p className="text-xs text-muted-foreground">
              This page refreshes automatically for a few minutes.{' '}
              <button type="button" className="underline underline-offset-4" onClick={() => void refetch()}>
                {isFetching ? 'Refreshing…' : 'Refresh now'}
              </button>
            </p>
          )}
          <Actions resume={resume} />
        </header>

        {resume.fileStatus === 'PARSED' && (
          <>
            <Section title="Skills we found">
              {resume.parsedSkills.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {resume.parsedSkills.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No skills were extracted. Matching still uses the full text.</p>
              )}
              {resume.parsedYears != null && (
                <p className="text-sm text-muted-foreground">
                  Estimated experience: {resume.parsedYears} {resume.parsedYears === 1 ? 'year' : 'years'}
                </p>
              )}
            </Section>

            <Section title="Extracted text">
              <p className="text-xs text-muted-foreground">
                This is exactly what the AI reads. If something important is missing, your PDF may use images or
                unusual layout.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowText((v) => !v)} aria-expanded={showText}>
                {showText ? 'Hide text' : 'Show text'}
              </Button>
              {showText && (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed">
                  {resume.content}
                </pre>
              )}
            </Section>
          </>
        )}

        <Section title="Analyses">
          {resume.analyses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No analyses yet.</p>
          ) : (
            <ul className="space-y-2">
              {resume.analyses.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <span>{new Date(a.createdAt).toLocaleString()}</span>
                  <span className="font-medium tabular-nums">
                    {a.status === 'COMPLETED' ? `${a.overallScore ?? '—'}/100` : a.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Tailored versions">
          {resume.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tailored versions yet.</p>
          ) : (
            <ul className="space-y-2">
              {resume.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <span>{v.label}</span>
                  <span className="text-muted-foreground">{v.status.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <aside className="space-y-4">{children}</aside>
    </div>
  );
};
