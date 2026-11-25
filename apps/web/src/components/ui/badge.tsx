import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-md transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/30 bg-primary/20 text-foreground',
        secondary: 'border-white/10 bg-white/[0.07] text-foreground/90',
        outline: 'border-white/15 bg-white/[0.03] text-foreground/90',
        destructive: 'border-rose-400/30 bg-rose-500/20 text-rose-100',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
