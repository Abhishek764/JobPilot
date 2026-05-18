import type { Schemas } from '@jobpilot/types';

import { NotFoundError } from '../../shared/errors';

import { jobRepository } from './job.repository';

export const jobService = {
  list(query: Schemas.ListJobsQuery) {
    return jobRepository.list(query);
  },

  async getById(id: string) {
    const job = await jobRepository.findById(id);
    if (!job) throw new NotFoundError('Job');
    return job;
  },
};
