'use client';

import { STATUS_LABELS, type ApplicationStatus } from '@jobpilot/types';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useApplicationInsights } from '../hooks';

const FUNNEL: ApplicationStatus[] = ['SAVED', 'APPLIED', 'OA', 'SCREEN', 'INTERVIEW', 'OFFER'];

const EVENT_VERB: Record<string, string> = {
  CREATED: 'Added',
  STATUS_CHANGED: 'Status changed',
  MOVED: 'Reordered',
  UPDATED: 'Edited',
  NOTE_ADDED: 'Note added',
  NOTE_UPDATED: 'Note edited',
  NOTE_DELETED: 'Note removed',
  REMINDER_ADDED: 'Reminder set',
  REMINDER_COMPLETED: 'Reminder done',
  REMINDER_DELETED: 'Reminder removed',
};

export const ApplicationInsights = ({ onOpen }: { onOpen?: (id: string) => void }) => {
  const { data, isPending, isError, refetch } = useApplicationInsights();

  if (isPending) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (isError) {
    return (
      <div role="alert" className="text-muted-foreground flex items-center gap-2 text-sm">
        Couldn’t load insights.
        <Button size="sm" variant="ghost" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (data.total === 0) {
    return (
      <p className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
        No applications yet. Save a job from <strong className="text-foreground">Jobs</strong> or
        add one manually to start tracking.
      </p>
    );
  }

  const latest = data.recentActivity[0];
  const closed = data.byStatus.REJECTED + data.byStatus.WITHDRAWN + data.byStatus.GHOSTED;

  return (
    <section aria-label="Application insights" className="grid gap-3 lg:grid-cols-[1fr_auto]">
      <ol className="flex flex-wrap gap-2">
        {FUNNEL.map((s) => (
          <li key={s} className="border-border bg-card/70 min-w-[88px] rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
              {STATUS_LABELS[s]}
            </p>
            <p className="text-xl font-semibold tabular-nums">{data.byStatus[s]}</p>
          </li>
        ))}
        <li className="border-border min-w-[88px] rounded-lg border px-3 py-2">
          <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Closed</p>
          <p className="text-muted-foreground text-xl font-semibold tabular-nums">{closed}</p>
        </li>
      </ol>
      <div className="space-y-1 text-sm lg:text-right">
        <p>
          <span className="font-semibold tabular-nums">{data.upcomingReminders}</span>{' '}
          <span className="text-muted-foreground">follow-ups due this week</span>
        </p>
        {latest && (
          <p className="text-muted-foreground">
            Latest:{' '}
            <button
              type="button"
              className="text-foreground underline-offset-4 hover:underline"
              onClick={() => onOpen?.(latest.applicationId)}
            >
              {EVENT_VERB[latest.type] ?? latest.type} · {latest.company}
            </button>{' '}
            · {new Date(latest.createdAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </section>
  );
};
