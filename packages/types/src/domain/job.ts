export interface Job {
  id: string;
  externalId: string | null;
  company: string;
  title: string;
  location: string | null;
  remote: boolean;
  description: string | null;
  url: string;
  source: string;
  postedAt: Date | null;
  scrapedAt: Date;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  tags: string[];
}

export interface JobMatch {
  jobId: string;
  score: number;
  reasoning: string;
  matchedSkills: string[];
  missingSkills: string[];
}
