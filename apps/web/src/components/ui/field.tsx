import * as React from 'react';

import { cn } from '@/lib/utils';

import { Label } from './label';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Field = ({ label, htmlFor, error, hint, required, className, children }: FieldProps) => (
  <div className={cn('space-y-1.5', className)}>
    <Label htmlFor={htmlFor}>
      {label}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
    </Label>
    {children}
    {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    {error ? (
      <p role="alert" className="text-xs text-red-500">
        {error}
      </p>
    ) : null}
  </div>
);
