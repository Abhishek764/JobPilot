'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Application, BoardColumnStatus } from '@jobpilot/types';
import { STATUS_LABELS } from '@jobpilot/types';

import { cn } from '@/lib/utils';

import { COLUMN_ACCENT, columnDroppableId } from '../board-utils';

import { ApplicationCard } from './application-card';

interface Props {
  status: BoardColumnStatus;
  items: Application[];
  onSelect: (id: string) => void;
}

export const BoardColumn = ({ status, items, onSelect }: Props) => {
  const { setNodeRef, isOver } = useDroppable({ id: columnDroppableId(status) });

  return (
    <section className="flex w-72 shrink-0 flex-col">
      <div className="flex items-center justify-between px-2 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className={cn('h-2 w-2 rounded-full', COLUMN_ACCENT[status])} />
          {STATUS_LABELS[status]}
        </h2>
        <span className="text-muted-foreground rounded-full bg-white/[0.08] px-2 py-0.5 text-xs tabular-nums">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'ease-spring flex min-h-32 flex-1 flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2 transition-colors duration-300',
          isOver && 'border-primary/40 bg-primary/[0.08]',
        )}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <ApplicationCard key={item.id} application={item} onSelect={onSelect} />
          ))}
        </SortableContext>
        {items.length === 0 ? (
          <p className="text-muted-foreground px-1 py-6 text-center text-xs">No applications</p>
        ) : null}
      </div>
    </section>
  );
};
