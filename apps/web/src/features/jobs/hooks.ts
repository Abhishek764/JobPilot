'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useToken } from '@/lib/use-token';

import { jobKeys, jobsApi, type JobFilters } from './api';

export const useJobs = (filters: JobFilters) => {
  const token = useToken();
  return useQuery({
    queryKey: jobKeys.list(filters),
    queryFn: async () => jobsApi.list(await token(), filters),
    placeholderData: keepPreviousData,
  });
};

export const useJob = (id: string) => {
  const token = useToken();
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: async () => jobsApi.get(await token(), id),
  });
};
