import { prisma } from '@jobpilot/db';

import { env } from '../config/env';

import { RateLimitError } from './errors';

type AiJobModel = 'matchAnalysis' | 'coverLetter' | 'resumeAnalysis' | 'resumeVersion';

const HOUR_MS = 60 * 60 * 1000;

/** Each AI job costs real tokens; cap how many of one kind a student can start per hour. */
export const assertAiQuota = async (
  model: AiJobModel,
  userId: string,
  now: Date = new Date(),
): Promise<void> => {
  const where = { userId, createdAt: { gte: new Date(now.getTime() - HOUR_MS) } };
  const delegate = prisma[model] as unknown as {
    count: (args: { where: typeof where }) => Promise<number>;
  };
  const recent = await delegate.count({ where });
  if (recent >= env.AI_JOBS_PER_HOUR) {
    throw new RateLimitError('Hourly AI limit reached — please try again later');
  }
};
