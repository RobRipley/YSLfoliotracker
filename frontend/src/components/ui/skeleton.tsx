import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Skeleton loader with shimmer animation.
 * Use to match the shape of content that's loading.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton-shimmer rounded-md',
        className
      )}
    />
  );
}

/**
 * Pre-built skeleton layout for the portfolio dashboard.
 * Matches the exact layout of the loaded dashboard.
 */
export function DashboardSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,3.5fr)_minmax(0,1.8fr)]">
      {/* Left: Holdings Table Skeleton */}
      <div className="space-y-4 min-w-0">
        <div className="glass-panel border-divide/80 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>

          {/* Category Header */}
          <div className="px-4 py-3 border-t border-divide-lighter/15">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
          </div>

          {/* Column Headers */}
          <div className="px-4 py-2 flex gap-6">
            {[80, 60, 50, 60, 70, 50, 40, 80].map((w, i) => (
              <Skeleton key={i} className="h-3" style={{ width: w }} />
            ))}
          </div>

          {/* Holdings Rows */}
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="px-4 py-3 flex items-center gap-4 border-t border-divide-lighter/8"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14 ml-auto" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}

          {/* Second Category */}
          <div className="px-4 py-3 border-t border-divide-lighter/15 mt-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
          </div>

          {[...Array(3)].map((_, i) => (
            <div
              key={`b${i}`}
              className="px-4 py-3 flex items-center gap-4 border-t border-divide-lighter/8"
            >
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14 ml-auto" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Right: Allocation + Exits Skeleton */}
      <div className="space-y-4">
        {/* Total Value Card */}
        <div className="glass-panel border-divide/80 rounded-xl p-4">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-3 w-20 mb-4" />
          <div className="border-t border-divide/60 pt-4">
            {/* Donut placeholder */}
            <div className="flex justify-center py-4">
              <Skeleton className="h-40 w-40 rounded-full" />
            </div>
            {/* Legend */}
            <div className="space-y-2 mt-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Nearest Exits Skeleton */}
        <div className="glass-panel border-divide/80 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4 mt-2" />
        </div>
      </div>
    </div>
  );
}
