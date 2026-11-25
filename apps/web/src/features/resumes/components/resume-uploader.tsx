'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { MAX_RESUME_BYTES, RESUME_ACCEPT, resumeMimeType } from '../api';
import { useUploadResume, type UploadStage } from '../hooks';

const STAGE_LABEL: Record<UploadStage, string> = {
  idle: 'Upload resume',
  ticket: 'Preparing upload…',
  uploading: 'Uploading…',
  ingesting: 'Queuing parse…',
};

const validate = (file: File): string | null => {
  if (!resumeMimeType(file)) return 'Please choose a PDF, DOCX or TXT file.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_RESUME_BYTES)
    return `File must be under ${MAX_RESUME_BYTES / 1024 / 1024} MB.`;
  return null;
};

export const ResumeUploader = () => {
  const router = useRouter();
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [stage, setStage] = useState<UploadStage>('idle');
  const upload = useUploadResume(setStage);

  const pick = (f: File | null) => {
    setClientError(null);
    upload.reset();
    if (!f) return setFile(null);
    const err = validate(f);
    if (err) {
      setFile(null);
      setClientError(err);
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.(pdf|docx|txt)$/i, ''));
  };

  return (
    <form
      className="border-border bg-card/50 space-y-4 rounded-xl border border-dashed p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return setClientError('Choose a file first.');
        upload.mutate(
          { file, title: title.trim() || file.name },
          { onSuccess: (resume) => router.push(`/resume/${resume.id}`) },
        );
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        pick(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <div>
        <h2 className="font-semibold tracking-tight">Upload a resume</h2>
        <p className="text-muted-foreground text-sm">
          PDF, DOCX or TXT, up to {MAX_RESUME_BYTES / 1024 / 1024} MB. Drop it here or browse. The
          file goes straight to private storage; only you can download it.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <div className="space-y-1">
          <label htmlFor={inputId} className="text-sm font-medium">
            File
          </label>
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept={RESUME_ACCEPT}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="file:bg-muted file:text-foreground block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${inputId}-title`} className="text-sm font-medium">
            Title
          </label>
          <Input
            id={`${inputId}-title`}
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Software internship 2027"
          />
        </div>
      </div>
      {(clientError || upload.isError) && (
        <p role="alert" className="text-sm text-rose-300">
          {clientError ?? upload.error?.message}
        </p>
      )}
      <Button type="submit" disabled={!file || upload.isPending} loading={upload.isPending}>
        {STAGE_LABEL[stage]}
      </Button>
    </form>
  );
};
