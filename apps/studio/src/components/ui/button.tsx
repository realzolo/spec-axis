import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] border text-[14px] font-medium leading-none transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ds-accent-7)/0.28)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/82',
        secondary: 'border-[hsl(var(--ds-border-1))] bg-[hsl(var(--ds-surface-1))] text-foreground hover:bg-[hsl(var(--ds-surface-2))] active:bg-[hsl(var(--ds-surface-3))]',
        outline: 'border-[hsl(var(--ds-border-1))] bg-transparent text-foreground hover:bg-[hsl(var(--ds-surface-1))] active:bg-[hsl(var(--ds-surface-2))]',
        ghost: 'border-transparent bg-transparent text-[hsl(var(--ds-text-2))] hover:bg-[hsl(var(--ds-surface-1))] hover:text-foreground',
        link: 'border-transparent text-[hsl(var(--ds-accent-8))] underline-offset-4 hover:underline',
        destructive: 'border-transparent bg-danger text-white hover:bg-danger/90 active:bg-danger/82',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-3 text-[13px]',
        lg: 'h-10 px-4.5 text-[14px]',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
