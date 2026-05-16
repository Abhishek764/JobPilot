export const APPLICATION_STATUSES = [
  'SAVED',
  'APPLIED',
  'SCREEN',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
  'GHOSTED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Application {
  id: string;
  userId: string;
  jobId: string | null;
  company: string;
  title: string;
  location: string | null;
  status: ApplicationStatus;
  appliedAt: Date | null;
  notes: string | null;
  source: string | null;
  url: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  createdAt: Date;
  updatedAt: Date;
}
