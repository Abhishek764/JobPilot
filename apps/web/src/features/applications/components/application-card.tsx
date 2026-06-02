'use client';

import type { Application } from '@jobpilot/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';

interface Props {
  application: Application;
  onSelect: (id: string) => void;
  overlay?: boolean;
}

const formatSalary = (a: Application): string | null => {
  if (a.salaryMin == null && a.salaryMax == null) return null;
  const cur = a.currency ?? '';
  const fmt = (n: number) => `${cur}${Math.round(n / 1000)}k`;
  if (a.salaryMin != null && a.salaryMax != null) return `${fmt(a.salaryMin)}–${fmt(a.salaryMax)}`;
  return fmt((a.salaryMin ?? a.salaryMax)!);
};

export const ApplicationCard = ({ application, onSelect, overlay }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });
  const salary = formatSalary(application);

  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(application.id)}
      className={cn(
        'w-full cursor-grab rounded-md border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        isDragging && !overlay && 'opacity-40',
        overlay && 'cursor-grabbing shadow-lg',
      )}
    >
      <p className="line-clamp-2 text-sm font-medium leading-snug">{application.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{application.company}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {application.location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {application.location}
          </span>
        ) : null}
        {salary ? <span className="font-medium text-foreground">{salary}</span> : null}
      </div>
    </button>
  );
};
