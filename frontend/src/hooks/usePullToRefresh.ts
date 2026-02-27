import { useRef, useEffect, useState, useCallback } from 'react';

interface PullToRefreshOptions {
  /** Callback triggered when user pulls down far enough and releases */
  onRefresh: () => Promise<void>;
  /** Minimum pull distance (px) to trigger refresh. Default: 80 */
  threshold?: number;
  /** Maximum pull indicator travel (px). Default: 120 */
  maxPull?: number;
  /** Only enable on mobile viewports. Default: true */
  mobileOnly?: boolean;
}

interface PullToRefreshState {
  /** Current pull distance in pixels (0 when not pulling) */
  pullDistance: number;
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** Ref to attach to the scrollable container */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Inline style to apply to the pull indicator */
  indicatorStyle: React.CSSProperties;
}

/**
 * Pull-to-refresh hook for mobile.
 * Attach `containerRef` to your scrollable container.
 * When the user pulls down from scroll-top, shows a pull indicator
 * and triggers `onRefresh` when released past threshold.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  mobileOnly = true,
}: PullToRefreshOptions): PullToRefreshState {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const isMobile = !mobileOnly || (typeof window !== 'undefined' && window.innerWidth < 640);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isMobile || isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [isMobile, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }

    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      // Rubber-band effect: diminishing returns past threshold
      const dampened = deltaY > threshold
        ? threshold + (deltaY - threshold) * 0.3
        : deltaY;
      setPullDistance(Math.min(dampened, maxPull));
      // Prevent default scroll when pulling
      e.preventDefault();
    } else {
      setPullDistance(0);
    }
  }, [isRefreshing, threshold, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.5); // Hold at half-threshold while refreshing
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isMobile) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, isMobile]);

  const indicatorStyle: React.CSSProperties = {
    height: `${pullDistance}px`,
    transition: isPulling.current ? 'none' : 'height 250ms ease-out',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return { pullDistance, isRefreshing, containerRef, indicatorStyle };
}
