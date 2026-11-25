import type { ResumeFileStatus } from '@jobpilot/types';

import { cn } from '@/lib/utils';

const STEPS: ResumeFileStatus[] = ['PENDING', 'UPLOADED', 'PARSING', 'PARSED'];

const LABEL: Record<ResumeFileStatus, string> = {
  PENDING: 'Waiting for upload',
  UPLOADED: 'Uploaded — queued for parsing',
  PARSING: 'Reading your resume',
  PARSED: 'Ready',
  FAILED: 'Parsing failed',
};

const TONE: Record<ResumeFileStatus, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  UPLOADED: 'bg-sky-400/10 text-sky-200/90',
  PARSING: 'bg-sky-400/10 text-sky-200/90',
  PARSED: 'bg-emerald-400/10 text-emerald-200/90',
  FAILED: 'bg-rose-400/10 text-rose-200/90',
};

export const ResumeStatusBadge = ({ status }: { status: ResumeFileStatus }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
      TONE[status],
    )}
  >
    {(status === 'UPLOADED' || status === 'PARSING') && (
      <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
    )}
    {LABEL[status]}
  </span>
);

/** PENDING → UPLOADED → PARSING → PARSED, with FAILED shown against the step it stopped on. */
export const ResumeProgress = ({
  status,
  error,
}: {
  status: ResumeFileStatus;
  error?: string | null;
}) => {
  const reached = status === 'FAILED' ? -1 : STEPS.indexOf(status);
  return (
    <div className="space-y-2">
      <ol className="flex gap-1.5" aria-label="Processing progress">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === reached ? 'step' : undefined}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              status === 'FAILED' ? 'bg-rose-500/40' : i <= reached ? 'bg-primary' : 'bg-muted',
            )}
          />
        ))}
      </ol>
      <p className="text-sm" role="status">
        <ResumeStatusBadge status={status} />
      </p>
      {status === 'FAILED' && error && <p className="text-sm text-rose-300">{error}</p>}
    </div>
  );
};
