'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { dashboardKeys } from '@/features/dashboard/api';
import { useToken } from '@/lib/use-token';

import { isProcessing, resumeKeys, resumeMimeType, resumesApi, type UploadMetadata } from './api';

const POLL_MS = 3_000;
/** Stop auto-polling after this long; the UI offers a manual refresh instead. */
export const POLL_WINDOW_MS = 3 * 60_000;

/** Poll while `active`, but only within a bounded window that restarts when activity begins. */
const useBoundedPoll = () => {
  const startedAt = useRef<number | null>(null);
  return (active: boolean): number | false => {
    if (!active) {
      startedAt.current = null;
      return false;
    }
    startedAt.current ??= Date.now();
    return Date.now() - startedAt.current < POLL_WINDOW_MS ? POLL_MS : false;
  };
};

export const useResumes = () => {
  const token = useToken();
  const poll = useBoundedPoll();
  return useQuery({
    queryKey: resumeKeys.list,
    queryFn: async () => resumesApi.list(await token()),
    refetchInterval: (q) =>
      poll(Boolean(q.state.data?.items.some((r) => isProcessing(r.fileStatus)))),
  });
};

export const useResume = (id: string) => {
  const token = useToken();
  const poll = useBoundedPoll();
  return useQuery({
    queryKey: resumeKeys.detail(id),
    queryFn: async () => resumesApi.get(await token(), id),
    refetchInterval: (q) => {
      const d = q.state.data;
      const pending = (s?: string) => s === 'QUEUED' || s === 'RUNNING';
      const aiWork =
        pending(d?.analyses[0]?.status) || Boolean(d?.versions.some((v) => pending(v.status)));
      return poll(Boolean(d && (isProcessing(d.fileStatus) || aiWork)));
    },
  });
};

export type UploadStage = 'idle' | 'ticket' | 'uploading' | 'ingesting';

/** Ticket → direct PUT to storage → ingest. Each step must succeed before the next. */
export const useUploadResume = (onStage: (s: UploadStage) => void) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      const metadata: UploadMetadata = {
        title,
        filename: file.name,
        contentType: resumeMimeType(file) ?? 'application/pdf',
        sizeBytes: file.size,
      };
      onStage('ticket');
      const ticket = await resumesApi.createUpload(await token(), metadata);
      onStage('uploading');
      try {
        const put = await fetch(ticket.upload.url, {
          method: ticket.upload.method,
          headers: ticket.upload.headers,
          body: file,
        });
        if (!put.ok) throw new Error(`Upload to storage failed (${put.status})`);
      } catch (err) {
        // The row was created for this upload; remove it so no stuck PENDING resume remains.
        await resumesApi.remove(await token(), ticket.resume.id).catch(() => undefined);
        throw err;
      }
      onStage('ingesting');
      return resumesApi.ingest(await token(), ticket.resume.id);
    },
    onSettled: () => {
      onStage('idle');
      void qc.invalidateQueries({ queryKey: resumeKeys.all });
      void qc.invalidateQueries({ queryKey: dashboardKeys.summary });
    },
  });
};

export const useDeleteResume = () => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => resumesApi.remove(await token(), id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: resumeKeys.all });
      void qc.invalidateQueries({ queryKey: dashboardKeys.summary });
    },
  });
};
