import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export function PageLoading({
  label = 'Loading...',
  className,
  size = 'lg',
}: {
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className={cn('h-full w-full flex items-center justify-center', className)}>
      <div className="flex flex-col items-center gap-3">
        <Spinner size={size} />
        {label ? <div className="text-sm text-muted-foreground">{label}</div> : null}
      </div>
    </div>
  );
}
