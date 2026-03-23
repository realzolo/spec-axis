import Image from 'next/image';
import { cn } from '@/lib/utils';

type SykraMarkProps = {
  className?: string;
  title?: string;
};

export default function SykraMark({ className, title = 'Sykra' }: SykraMarkProps) {
  return (
    <Image
      src="/brand/logo.png"
      alt={title}
      width={40}
      height={40}
      className={cn('h-10 w-10', className)}
    />
  );
}
