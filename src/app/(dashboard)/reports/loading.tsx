import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsLoading() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-[1200px] mx-auto w-full px-6 py-6 space-y-4">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="grid grid-cols-[64px_1fr_160px_auto] items-center px-4 py-2 border-b border-border bg-muted/60 gap-4">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-6" />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`report-skeleton-${index}`} className="grid grid-cols-[64px_1fr_160px_auto] items-center px-4 py-3 border-b border-border last:border-0 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-3 w-8" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
