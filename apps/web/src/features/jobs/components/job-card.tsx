import type { Job } from '@jobpilot/types';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';

import { formatPosted, formatSalary, platformLabel } from '../format';

export const JobCard = ({ job }: { job: Job }) => {
  const salary = formatSalary(job);
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold tracking-tight group-hover:text-primary">{job.title}</h3>
          <p className="truncate text-sm text-muted-foreground">{job.company}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {platformLabel(job.sourcePlatform)}
        </Badge>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{job.location ?? 'Location not listed'}</span>
        {job.remote && <span className="text-emerald-400">Remote</span>}
        <span>{formatPosted(job.postedAt)}</span>
        {salary && <span className="font-medium text-foreground">{salary}</span>}
      </div>
      {job.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 6).map((s) => (
            <Badge key={s} variant="secondary" className="text-[11px]">
              {s}
            </Badge>
          ))}
        </div>
      )}
    </Link>
  );
};
