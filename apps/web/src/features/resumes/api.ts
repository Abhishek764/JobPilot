import { RESUME_FILE_TYPES } from '@jobpilot/types';
import type {
  CoverLetter,
  PaginatedResult,
  Resume,
  ResumeAnalysis,
  ResumeMimeType,
  ResumeVersion,
} from '@jobpilot/types';

import { apiFetch } from '@/lib/api-client';

export interface UploadMetadata {
  title: string;
  filename: string;
  contentType: ResumeMimeType;
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
/** Browsers often leave `file.type` empty for DOCX; fall back to the extension. */
export const resumeMimeType = (file: File): ResumeMimeType | null => {
  if (file.type && file.type in RESUME_FILE_TYPES) return file.type as ResumeMimeType;
  const ext = file.name.split('.').pop()?.toLowerCase();
  const match = Object.entries(RESUME_FILE_TYPES).find(([, e]) => e === ext);
  return match ? (match[0] as ResumeMimeType) : null;
};

export const RESUME_ACCEPT = Object.entries(RESUME_FILE_TYPES)
  .flatMap(([mime, ext]) => [mime, `.${ext}`])
  .join(',');

export const MAX_RESUME_BYTES = 15 * 1024 * 1024;
