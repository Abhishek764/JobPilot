'use client';

import { COVER_LETTER_TONES, type CoverLetterTone } from '@jobpilot/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useResumes } from '@/features/resumes/hooks';
import { useToken } from '@/lib/use-token';

import { coverLetterKeys, coverLettersApi, isLetterPending } from '../api';

const TONE_LABEL: Record<CoverLetterTone, string> = {
  PROFESSIONAL: 'Professional',
  ENTHUSIASTIC: 'Enthusiastic',
  CONCISE: 'Concise',
  STORYTELLING: 'Story-driven',
};

const POLL_MS = 3_000;
const POLL_WINDOW_MS = 3 * 60_000;

/**
 * Generate a cover letter for one application. Generation is queued on the API; this
 * panel polls the persisted letter and lets the student edit and copy the draft.
 */
export const CoverLetterPanel = ({ jobId }: { jobId: string | null }) => {
  const token = useToken();
  const qc = useQueryClient();
  const resumes = useResumes();
  const parsed = resumes.data?.items.filter((r) => r.fileStatus === 'PARSED') ?? [];

  const [resumeId, setResumeId] = useState('');
  const [tone, setTone] = useState<CoverLetterTone>('PROFESSIONAL');
  const [pasted, setPasted] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const pollStart = useRef<number | null>(null);

  const firstParsedId = parsed[0]?.id;
  useEffect(() => {
    if (!resumeId && firstParsedId) setResumeId(firstParsedId);
  }, [firstParsedId, resumeId]);

  const existing = useQuery({
    queryKey: coverLetterKeys.forJob(jobId ?? ''),
    enabled: Boolean(jobId),
    queryFn: async () => coverLettersApi.list(await token(), { jobId: jobId! }),
  });
  useEffect(() => {
    if (!activeId && existing.data?.[0]) setActiveId(existing.data[0].id);
  }, [existing.data, activeId]);

  const letter = useQuery({
    queryKey: coverLetterKeys.detail(activeId ?? ''),
    enabled: Boolean(activeId),
    queryFn: async () => coverLettersApi.get(await token(), activeId!),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (!s || !isLetterPending(s)) {
        pollStart.current = null;
        return false;
      }
      pollStart.current ??= Date.now();
      return Date.now() - pollStart.current < POLL_WINDOW_MS ? POLL_MS : false;
    },
  });

  // Seed the editable draft whenever a different completed letter arrives.
  const loadedId = letter.data?.status === 'COMPLETED' ? letter.data.id : null;
  useEffect(() => {
    if (loadedId && letter.data?.content) setDraft(letter.data.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId]);

  const create = useMutation({
    mutationFn: async () =>
      coverLettersApi.create(await token(), resumeId, {
        tone,
        ...(jobId ? { jobId } : {}),
        ...(pasted.trim() ? { jobDescription: pasted.trim() } : {}),
      }),
    onSuccess: (created) => {
      setActiveId(created.id);
      void qc.invalidateQueries({ queryKey: coverLetterKeys.all });
    },
  });

  const needsPaste = !jobId;
  const canGenerate = Boolean(resumeId) && (!needsPaste || pasted.trim().length >= 50);
  const current = letter.data;
  const pending = current ? isLetterPending(current.status) : false;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (resumes.isPending) return <p className="text-sm text-muted-foreground">Loading resumes…</p>;
  if (parsed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Upload a resume in the{' '}
        <Link href="/resume" className="text-primary underline-offset-4 hover:underline">
          Resume Lab
        </Link>{' '}
        to generate a cover letter.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canGenerate) create.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <Select aria-label="Resume" value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
            {parsed.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </Select>
          <Select aria-label="Tone" value={tone} onChange={(e) => setTone(e.target.value as CoverLetterTone)}>
            {COVER_LETTER_TONES.map((t) => (
              <option key={t} value={t}>
                {TONE_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
        {needsPaste && (
          <Textarea
            aria-label="Job description"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={4}
            placeholder="This application isn’t linked to a listing — paste the job description (50+ characters)."
          />
        )}
        <Button type="submit" size="sm" disabled={!canGenerate || pending} loading={create.isPending}>
          {current ? 'Generate a new draft' : 'Generate cover letter'}
        </Button>
        {create.isError && (
          <p role="alert" className="text-sm text-rose-300">
            {create.error.message}
          </p>
        )}
      </form>

      {current && (
        <div aria-live="polite" className="space-y-2">
          {pending ? (
            <p className="text-sm text-muted-foreground">
              <span aria-hidden className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              Writing your draft…{' '}
              <button type="button" className="underline underline-offset-4" onClick={() => void letter.refetch()}>
                Refresh
              </button>
            </p>
          ) : current.status === 'FAILED' ? (
            <div role="alert" className="space-y-2 text-sm">
              <p className="text-rose-300">Generation failed{current.error ? `: ${current.error}` : '.'}</p>
              <Button size="sm" variant="outline" disabled={!canGenerate} onClick={() => create.mutate()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Textarea
                aria-label="Cover letter draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={12}
                className="text-sm leading-relaxed"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  AI draft from your resume — review and edit before sending. Edits stay in this window.
                </p>
                <Button size="sm" variant="outline" onClick={() => void copy()}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
