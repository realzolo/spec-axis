import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectDetailLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background shrink-0 px-4">
        <div className="flex items-center gap-3 h-11">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-5 h-16 border-b border-border bg-card shrink-0">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-7 w-28 rounded-md" />
          </div>
          <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-border bg-card/50 shrink-0">
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
            <Skeleton className="h-3 w-24 ml-auto" />
          </div>
          <div className="flex-1 overflow-auto bg-muted/30 p-4">
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={`commit-skeleton-${index}`} className="rounded-xl border border-border bg-card px-4 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded-md" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
