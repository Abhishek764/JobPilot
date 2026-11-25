import * as React from 'react';

import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'glass-field flex h-10 w-full rounded-xl px-3.5 py-2 text-sm backdrop-blur-xl [&>option]:bg-[hsl(var(--card))]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-red-500',
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = 'Select';
