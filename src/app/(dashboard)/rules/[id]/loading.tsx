import { Skeleton } from '@/components/ui/skeleton';

export default function RuleSetDetailLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1200px] mx-auto w-full px-6 py-6 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`rulecat-skeleton-${index}`} className="border border-border rounded-lg overflow-hidden bg-card">
              <div className="flex items-center gap-2 px-6 py-2 border-b border-border bg-muted/40">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </div>
              {Array.from({ length: 2 }).map((_, ruleIndex) => (
                <div key={`rule-skeleton-${index}-${ruleIndex}`} className="flex items-start gap-3 px-6 py-4 border-b border-border last:border-0">
                  <Skeleton className="h-5 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
