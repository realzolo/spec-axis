import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
        <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-[7px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-surface-1))] px-3 py-2 text-[14px] text-foreground placeholder:text-[hsl(var(--ds-text-2))] transition-[background-color,border-color,box-shadow] duration-150 focus:outline-none focus:border-[hsl(var(--ds-border-3))] focus:ring-2 focus:ring-[hsl(var(--ds-accent-7)/0.25)] hover:bg-[hsl(var(--ds-surface-2))] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
