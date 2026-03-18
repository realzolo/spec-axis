import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-[background-color,border-color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ds-accent-7))/0.45] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] disabled:cursor-not-allowed disabled:opacity-45 data-[state=unchecked]:border-[hsl(var(--ds-border-2))] data-[state=unchecked]:bg-[hsl(var(--ds-surface-2))] data-[state=checked]:border-[hsl(var(--foreground))] data-[state=checked]:bg-[hsl(var(--foreground))]',
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-full border transition-[transform,background-color,border-color] duration-150 ease-out will-change-transform data-[state=unchecked]:translate-x-0 data-[state=unchecked]:border-[hsl(var(--ds-border-2))] data-[state=unchecked]:bg-[hsl(var(--background))] data-[state=checked]:translate-x-4 data-[state=checked]:border-[hsl(var(--background))] data-[state=checked]:bg-[hsl(var(--background))] shadow-sm',
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
