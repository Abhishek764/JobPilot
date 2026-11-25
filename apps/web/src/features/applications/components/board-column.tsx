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
      <div
        className={cn(
          'flex items-center justify-between rounded-t-md border-t-4 px-1 pb-2',
          COLUMN_ACCENT[status],
        )}
      >
        <h2 className="text-sm font-semibold">{STATUS_LABELS[status]}</h2>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
          {items.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'bg-muted/40 flex min-h-32 flex-1 flex-col gap-2 rounded-md p-2 transition-colors',
          isOver && 'bg-muted',
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
