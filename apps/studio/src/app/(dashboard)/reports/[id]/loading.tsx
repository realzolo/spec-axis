import { Skeleton } from '@/components/ui/skeleton';

export default function ReportDetailLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3 px-6 h-16 max-w-[1200px] mx-auto w-full">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-6 space-y-3">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`score-skeleton-${index}`} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="px-6 py-4 flex gap-6 flex-wrap items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-28 rounded-md ml-auto" />
            </div>
            <div className="border-t border-border">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`commit-row-skeleton-${index}`} className="flex items-center gap-3 px-6 py-3 border-b border-border last:border-0">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-20 ml-auto" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-2 py-2">
              <div className="flex items-center gap-2 h-11">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            </div>
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`issue-skeleton-${index}`} className="rounded-lg border border-border bg-muted/10 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>
        </div>
      </div>
    </div>
  );
}
