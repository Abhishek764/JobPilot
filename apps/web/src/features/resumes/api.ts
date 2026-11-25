import type {
  CoverLetter,
  PaginatedResult,
  Resume,
  ResumeAnalysis,
  ResumeVersion,
} from '@jobpilot/types';

import { apiFetch } from '@/lib/api-client';

export interface UploadMetadata {
  title: string;
  filename: string;
  contentType: 'application/pdf';
  sizeBytes: number;
}

export interface UploadTicket {
  resume: Resume;
  upload: { url: string; key: string; method: 'PUT'; headers: Record<string, string> };
}

export interface ResumeDetail extends Resume {
  analyses: ResumeAnalysis[];
  versions: ResumeVersion[];
  coverLetters: CoverLetter[];
}

export const resumesApi = {
  createUpload: (token: string | null, body: UploadMetadata) =>
    apiFetch<UploadTicket>('/resumes/upload-ticket', { method: 'POST', body, token }),
  ingest: (token: string | null, id: string) =>
    apiFetch<Resume>(`/resumes/${id}/ingest`, { method: 'POST', token }),
  list: (token: string | null, page = 1) =>
    apiFetch<PaginatedResult<Resume>>(`/resumes?page=${page}`, { token }),
  get: (token: string | null, id: string) => apiFetch<ResumeDetail>(`/resumes/${id}`, { token }),
  downloadUrl: (token: string | null, id: string) =>
    apiFetch<{ url: string }>(`/resumes/${id}/download`, { token }),
  analyze: (token: string | null, id: string, body: { jobId?: string; jobDescription?: string }) =>
    apiFetch<ResumeAnalysis>(`/resumes/${id}/analyses`, { method: 'POST', body, token }),
  remove: (token: string | null, id: string) =>
    apiFetch<void>(`/resumes/${id}`, { method: 'DELETE', token }),
};

export const resumeKeys = {
  all: ['resumes'] as const,
  list: ['resumes', 'list'] as const,
  detail: (id: string) => ['resumes', id] as const,
};

/** A resume is still moving through the pipeline and worth polling. */
export const isProcessing = (status: Resume['fileStatus']) =>
  status === 'PENDING' || status === 'UPLOADED' || status === 'PARSING';

/** Mirrors the API default RESUME_MAX_BYTES; the API remains the authority. */
export const MAX_RESUME_BYTES = 15 * 1024 * 1024;
