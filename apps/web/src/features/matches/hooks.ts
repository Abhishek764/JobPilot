'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { dashboardKeys } from '@/features/dashboard/api';
import { useToken } from '@/lib/use-token';

import { isMatchPending, matchesApi, matchKeys, type MatchTrack } from './api';

const POLL_MS = 3_000;
const POLL_WINDOW_MS = 3 * 60_000;

export const useLatestMatchForJob = (jobId: string) => {
  const token = useToken();
  return useQuery({
    queryKey: matchKeys.forJob(jobId),
    queryFn: async () => (await matchesApi.list(await token(), { jobId, pageSize: 1 }))[0] ?? null,
  });
};

export const useMatchesForResume = (resumeId: string) => {
  const token = useToken();
  return useQuery({
    queryKey: matchKeys.forResume(resumeId),
    queryFn: async () => matchesApi.list(await token(), { resumeId, pageSize: 10 }),
  });
};

/** Poll one analysis while it's queued/running, within a bounded window. */
export const useMatch = (id: string | null) => {
  const token = useToken();
  const startedAt = useRef<number | null>(null);
  return useQuery({
    queryKey: matchKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => matchesApi.get(await token(), id!),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data || !isMatchPending(data.status)) {
        startedAt.current = null;
        return false;
      }
      startedAt.current ??= Date.now();
      return Date.now() - startedAt.current < POLL_WINDOW_MS ? POLL_MS : false;
    },
  });
};

export const useStartMatch = () => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { resumeId: string; jobId: string; track: MatchTrack }) =>
      matchesApi.create(await token(), body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: matchKeys.all });
      void qc.invalidateQueries({ queryKey: dashboardKeys.summary });
    },
  });
};
