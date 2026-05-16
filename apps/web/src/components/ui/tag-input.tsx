'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { Badge } from './badge';

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  id?: string;
  ariaInvalid?: boolean;
  className?: string;
}

export const TagInput = ({
  value,
  onChange,
  placeholder = 'Type and press Enter',
  maxItems = 50,
  id,
  ariaInvalid,
  className,
}: TagInputProps) => {
  const [draft, setDraft] = React.useState('');

  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    if (value.length >= maxItems) return;
    onChange([...value, trimmed]);
    setDraft('');
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div
      className={cn(
        'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        ariaInvalid ? 'border-red-500' : '',
        className,
      )}
    >
      {value.map((tag, idx) => (
        <Badge key={`${tag}-${idx}`} variant="secondary" className="gap-1">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            className="rounded-sm opacity-70 hover:opacity-100"
            onClick={() => remove(idx)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        id={id}
        className="flex-1 min-w-[8rem] bg-transparent outline-none placeholder:text-muted-foreground"
        placeholder={value.length === 0 ? placeholder : ''}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            remove(value.length - 1);
          }
        }}
        onBlur={() => add(draft)}
      />
    </div>
  );
};
