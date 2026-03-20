import * as React from 'react';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[88px] w-full rounded-[7px] border border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-surface-1))] px-3 py-2.5 text-[14px] text-foreground placeholder:text-[hsl(var(--ds-text-2))] transition-[background-color,border-color,box-shadow] duration-150 focus:outline-none focus:border-[hsl(var(--ds-border-3))] focus:ring-2 focus:ring-[hsl(var(--ds-accent-7)/0.25)] hover:bg-[hsl(var(--ds-surface-2))] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
