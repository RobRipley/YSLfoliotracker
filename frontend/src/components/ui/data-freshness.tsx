import { useState, useEffect } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';

interface DataFreshnessProps {
  lastUpdated: Date | null;
  isRefreshing?: boolean;
  className?: string;
}

/**
 * Subtle data freshness indicator.
 * Shows when prices were last synced to reduce "is this stale?" anxiety.
 */
export function DataFreshness({ lastUpdated, isRefreshing, className }: DataFreshnessProps) {
  const [, setTick] = useState(0);

  // Re-render every 30s to keep "X ago" fresh
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;

    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className={`flex items-center gap-1.5 text-[10px] text-muted-foreground/50 ${className ?? ''}`}>
      {isRefreshing ? (
        <>
          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
          <span>Syncing prices...</span>
        </>
      ) : lastUpdated ? (
        <>
          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500/50" />
          <span>Prices synced {formatTime(lastUpdated)}</span>
        </>
      ) : (
        <span>Waiting for price data...</span>
      )}
    </div>
  );
}
