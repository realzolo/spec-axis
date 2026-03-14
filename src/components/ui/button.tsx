'use client';

import { Button as HeroButton } from '@heroui/react';
import type { ComponentPropsWithRef } from 'react';
import { Loader2 } from 'lucide-react';

type HeroButtonProps = ComponentPropsWithRef<typeof HeroButton>;

interface ButtonProps extends Omit<HeroButtonProps, 'isDisabled'> {
  isLoading?: boolean;
  isDisabled?: boolean;
}

export function Button({ isLoading, isDisabled, children, ...props }: ButtonProps) {
  return (
    <HeroButton isDisabled={isDisabled || isLoading} {...props}>
      {isLoading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </HeroButton>
  );
}
