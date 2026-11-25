import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium',
    'transition-[transform,background-color,border-color,box-shadow,opacity] duration-300 ease-spring',
    'active:scale-[0.97] active:duration-100',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        // Soft white pill with a faint top highlight, as in visionOS/iOS controls.
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.25)] hover:brightness-110',
        destructive:
          'bg-rose-500/90 text-white shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3)] hover:bg-rose-500',
        outline:
          'glass-field text-foreground backdrop-blur-xl hover:bg-white/10 hover:border-white/25',
        secondary: 'bg-white/10 text-foreground backdrop-blur-xl hover:bg-white/15',
        ghost: 'text-muted-foreground hover:bg-white/10 hover:text-foreground',
        link: 'rounded-md text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5',
        sm: 'h-9 px-4',
        lg: 'h-12 px-7 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, children, disabled, ...props },
    ref,
  ) => {
    // Slot requires exactly one child, so asChild buttons skip the loading spinner.
    if (asChild) {
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
