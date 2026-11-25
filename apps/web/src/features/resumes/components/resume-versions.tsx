'use client';

import type { ResumeVersion } from '@jobpilot/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/lib/use-token';

import { resumeKeys, resumesApi, type ResumeDetail } from '../api';

const isPending = (s: ResumeVersion['status']) => s === 'QUEUED' || s === 'RUNNING';

const VersionItem = ({ v }: { v: ResumeVersion }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(v.markdown ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <li className="border-border rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{v.label}</span>
        {v.status === 'COMPLETED' ? (
          <div className="flex shrink-0 gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
            >
              {open ? 'Hide' : 'View'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy Markdown'}
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground shrink-0">
            {isPending(v.status) ? 'tailoring…' : 'failed'}
          </span>
        )}
      </div>
      {v.status === 'FAILED' && v.error && <p className="mt-1 text-rose-300">{v.error}</p>}
      {open && v.markdown && (
        <pre className="border-border bg-muted/40 mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border p-4 text-xs leading-relaxed">
          {v.markdown}
        </pre>
      )}
    </li>
  );
};

/** Generate job-specific rewrites of a parsed resume (facts unchanged) and copy them out. */
export const ResumeVersionsPanel = ({ resume }: { resume: ResumeDetail }) => {
  const token = useToken();
  const qc = useQueryClient();
  const [jd, setJd] = useState('');
  const [label, setLabel] = useState('');

  const tailor = useMutation({
    mutationFn: async () =>
      resumesApi.tailor(await token(), resume.id, {
        jobDescription: jd.trim(),
        ...(label.trim() ? { label: label.trim() } : {}),
      }),
    onSuccess: () => {
      setJd('');
      setLabel('');
      void qc.invalidateQueries({ queryKey: resumeKeys.detail(resume.id) });
    },
  });

  return (
    <section className="space-y-3" aria-labelledby="versions-h">
      <h2
        id="versions-h"
        className="text-muted-foreground text-sm font-medium uppercase tracking-wide"
      >
        Tailored versions
      </h2>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (jd.trim().length >= 50) tailor.mutate();
        }}
      >
        <Textarea
          aria-label="Job description to tailor for"
          rows={3}
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste a job description (50+ characters) to get a rewrite of this resume aimed at it. Your facts stay the same."
        />
        <div className="flex gap-2">
          <Input
            aria-label="Version name"
            value={label}
            maxLength={120}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Name (optional)"
          />
          <Button
            type="submit"
            size="sm"
            className="h-10 shrink-0"
            loading={tailor.isPending}
            disabled={jd.trim().length < 50}
          >
            Tailor resume
          </Button>
        </div>
        {tailor.isError && (
          <p role="alert" className="text-sm text-rose-300">
            {tailor.error.message}
          </p>
        )}
      </form>
      {resume.versions.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {resume.versions.map((v) => (
            <VersionItem key={v.id} v={v} />
          ))}
        </ul>
      )}
    </section>
  );
};
