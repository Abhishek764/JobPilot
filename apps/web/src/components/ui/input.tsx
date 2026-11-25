import * as React from 'react';

import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'glass-field flex h-10 w-full rounded-xl px-3.5 py-2 text-sm backdrop-blur-xl',
        'placeholder:text-muted-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
