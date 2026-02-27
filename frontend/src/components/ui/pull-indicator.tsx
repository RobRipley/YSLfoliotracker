import { Loader2 } from 'lucide-react';
import { getActiveBrand } from '@/lib/branding';

interface PullIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
  style?: React.CSSProperties;
}

/**
 * Pull-to-refresh indicator.
 * Shows a spinning brand logo when refreshing, or a progress ring while pulling.
 */
export function PullIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
  style,
}: PullIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const brand = getActiveBrand();

  return (
    <div style={style} className="pointer-events-none">
      <div
        className="flex items-center justify-center"
        style={{
          opacity: Math.min(progress * 1.5, 1),
          transform: `scale(${0.5 + progress * 0.5}) rotate(${progress * 180}deg)`,
          transition: isRefreshing ? 'none' : 'transform 100ms ease-out',
        }}
      >
        {isRefreshing ? (
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        ) : (
          <svg
            className="h-6 w-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: progress >= 1 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
          >
            {/* Circular progress */}
            <circle
              cx="12"
              cy="12"
              r="10"
              strokeDasharray={`${progress * 63} 63`}
              strokeOpacity={0.3}
            />
            {/* Arrow down */}
            <path d="M12 8v8M8 12l4 4 4-4" strokeOpacity={progress} />
          </svg>
        )}
      </div>
    </div>
  );
}
