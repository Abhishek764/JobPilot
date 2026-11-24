import type { CoverLetter, CoverLetterTone } from '@jobpilot/types';

import { apiFetch } from '@/lib/api-client';

export interface CreateCoverLetterBody {
  jobId?: string;
  jobDescription?: string;
  tone: CoverLetterTone;
}

export const coverLettersApi = {
  create: (token: string | null, resumeId: string, body: CreateCoverLetterBody) =>
    apiFetch<CoverLetter>(`/resumes/${resumeId}/cover-letters`, { method: 'POST', body, token }),
  get: (token: string | null, id: string) =>
    apiFetch<CoverLetter>(`/cover-letters/${id}`, { token }),
  list: (token: string | null, filter: { jobId?: string; resumeId?: string }) => {
    const sp = new URLSearchParams();
    if (filter.jobId) sp.set('jobId', filter.jobId);
    if (filter.resumeId) sp.set('resumeId', filter.resumeId);
    return apiFetch<CoverLetter[]>(`/cover-letters?${sp.toString()}`, { token });
  },
};

export const coverLetterKeys = {
  all: ['cover-letters'] as const,
  forJob: (jobId: string) => ['cover-letters', 'job', jobId] as const,
  detail: (id: string) => ['cover-letters', id] as const,
};

export const isLetterPending = (s: CoverLetter['status']) => s === 'QUEUED' || s === 'RUNNING';
