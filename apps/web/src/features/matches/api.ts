import { apiFetch } from '@/lib/api-client';

export const MATCH_TRACKS = ['BACKEND', 'FRONTEND', 'FULLSTACK', 'DEVOPS'] as const;
export type MatchTrack = (typeof MATCH_TRACKS)[number];
export type MatchStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface MatchBreakdown {
  coreSkills: number;
  experience: number;
  projects: number;
  jobAlignment: number;
}

/** Mirrors the persisted MatchAnalysis row returned by GET /ai/match/:id. */
export interface MatchAnalysis {
  id: string;
  resumeId: string;
  jobId: string | null;
  track: MatchTrack;
  status: MatchStatus;
  model: string | null;
  compatibility: number | null;
  readiness: number | null;
  strengths: string[];
  missingSkills: string[];
  suggestions: string[];
  breakdown: MatchBreakdown | null;
  rawResult: { summary?: string } | null;
  cacheHit: boolean;
  error: string | null;
  completedAt: string | null;
  createdAt: string;
}

const qs = (params: Record<string, string | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return sp.toString();
};

export const matchesApi = {
  create: (token: string | null, body: { resumeId: string; jobId: string; track: MatchTrack }) =>
    apiFetch<Pick<MatchAnalysis, 'id' | 'status' | 'track' | 'createdAt'>>('/ai/match', {
      method: 'POST',
      body,
      token,
    }),
  get: (token: string | null, id: string) => apiFetch<MatchAnalysis>(`/ai/match/${id}`, { token }),
  list: (token: string | null, filters: { jobId?: string; resumeId?: string; pageSize?: number }) =>
    apiFetch<MatchAnalysis[]>(
      `/ai/match?${qs({ jobId: filters.jobId, resumeId: filters.resumeId, pageSize: String(filters.pageSize ?? 10) })}`,
      { token },
    ),
};

export const matchKeys = {
  all: ['matches'] as const,
  forJob: (jobId: string) => ['matches', 'job', jobId] as const,
  forResume: (resumeId: string) => ['matches', 'resume', resumeId] as const,
  detail: (id: string) => ['matches', id] as const,
};

export const isMatchPending = (s: MatchStatus) => s === 'QUEUED' || s === 'RUNNING';
