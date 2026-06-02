'use client';

import type { Application, Board, BoardColumnStatus } from '@jobpilot/types';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { isColumnId, positionBetween, statusFromColumnId } from '../board-utils';
import { useBoard, useMoveApplication } from '../hooks';
import { useApplicationsRealtime } from '../realtime';

import { AddApplicationDialog } from './add-application-dialog';
import { ApplicationCard } from './application-card';
import { BoardColumn } from './board-column';

const useDebounced = <T,>(value: T, ms: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};

interface Props {
  onSelect: (id: string) => void;
}

export const KanbanBoard = ({ onSelect }: Props) => {
  useApplicationsRealtime();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 250);
  const filters = useMemo(() => ({ search: debouncedSearch || undefined }), [debouncedSearch]);

  const { data, isLoading } = useBoard(filters);
  const move = useMoveApplication();

  const [columns, setColumns] = useState<Board['columns']>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Resync from the server whenever fresh data arrives and we are not dragging.
  useEffect(() => {
    if (data && !activeId) setColumns(data.columns);
  }, [data, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const findContainer = (id: string): BoardColumnStatus | null => {
    if (isColumnId(id)) return statusFromColumnId(id) as BoardColumnStatus;
    return columns.find((c) => c.items.some((i) => i.id === id))?.status ?? null;
  };

  const activeCard = useMemo<Application | undefined>(
    () => columns.flatMap((c) => c.items).find((i) => i.id === activeId),
    [columns, activeId],
  );

  const onDragStart = (e: DragStartEvent): void => setActiveId(String(e.active.id));

  /** Live cross-column move so the card visually follows the cursor. */
  const onDragOver = (e: DragOverEvent): void => {
    const { active, over } = e;
    if (!over) return;
    const activeContainer = findContainer(String(active.id));
    const overContainer = findContainer(String(over.id));
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setColumns((prev) => {
      const cols = prev.map((c) => ({ ...c, items: [...c.items] }));
      const from = cols.find((c) => c.status === activeContainer)!;
      const to = cols.find((c) => c.status === overContainer)!;
      const idx = from.items.findIndex((i) => i.id === active.id);
      if (idx === -1) return prev;
      const [card] = from.items.splice(idx, 1);
      if (!card) return prev;
      const overIdx = to.items.findIndex((i) => i.id === over.id);
      const insertAt = overIdx === -1 ? to.items.length : overIdx;
      to.items.splice(insertAt, 0, { ...card, status: overContainer });
      from.total = from.items.length;
      to.total = to.items.length;
      return cols;
    });
  };

  const onDragEnd = (e: DragEndEvent): void => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const targetStatus = findContainer(String(over.id));
    if (!targetStatus) return;

    let nextPosition: number | null = null;
    setColumns((prev) => {
      const cols = prev.map((c) => ({ ...c, items: [...c.items] }));
      const col = cols.find((c) => c.status === targetStatus)!;
      const fromIndex = col.items.findIndex((i) => i.id === active.id);
      if (fromIndex === -1) return prev;

      const overIndex = isColumnId(String(over.id))
        ? col.items.length - 1
        : col.items.findIndex((i) => i.id === over.id);
      const toIndex = overIndex === -1 ? col.items.length - 1 : overIndex;

      col.items = arrayMove(col.items, fromIndex, toIndex);
      const idx = col.items.findIndex((i) => i.id === active.id);
      const card = col.items[idx];
      if (!card) return prev;
      nextPosition = positionBetween(col.items[idx - 1]?.position, col.items[idx + 1]?.position);
      col.items[idx] = { ...card, position: nextPosition, status: targetStatus };
      return cols;
    });

    if (nextPosition != null) {
      move.mutate({ id: String(active.id), status: targetStatus, position: nextPosition });
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company or role…"
            className="pl-9"
          />
        </div>
        <AddApplicationDialog />
      </div>

      {isLoading && columns.length === 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-md" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
            {columns.map((col) => (
              <BoardColumn
                key={col.status}
                status={col.status}
                items={col.items}
                onSelect={onSelect}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? (
              <ApplicationCard application={activeCard} onSelect={() => undefined} overlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};
