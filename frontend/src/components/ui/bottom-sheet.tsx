import * as React from "react";
import { X } from "lucide-react";

type SnapPoint = 0.3 | 0.6 | 0.9;

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Starting snap point when sheet opens. Default: 0.6 (60% of viewport) */
  initialSnap?: SnapPoint;
  /** Available snap points. Default: [0.3, 0.6, 0.9] */
  snapPoints?: SnapPoint[];
}

const DISMISS_THRESHOLD = 60; // px dragged down below lowest snap to close
const SNAP_VELOCITY_THRESHOLD = 0.5; // px/ms — fast flick auto-snaps

/**
 * BottomSheet with snap points for mobile progressive disclosure.
 * Supports 3 states: peek (30%), detail (60%), fullscreen (90%).
 * Drag between snap points or flick to jump.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onOpenChange,
  children,
  initialSnap = 0.6,
  snapPoints = [0.3, 0.6, 0.9],
}) => {
  const [phase, setPhase] = React.useState<'entering' | 'open' | 'closing' | 'closed'>('closed');
  const [currentSnap, setCurrentSnap] = React.useState<SnapPoint>(initialSnap);
  const [dragY, setDragY] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartY = React.useRef(0);
  const dragStartTime = React.useRef(0);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  // Sort snap points ascending
  const sortedSnaps = React.useMemo(() => [...snapPoints].sort((a, b) => a - b), [snapPoints]);
  const lowestSnap = sortedSnaps[0];

  // Convert snap ratio to pixel height
  const snapToHeight = (snap: SnapPoint) => window.innerHeight * snap;
  const currentHeight = snapToHeight(currentSnap);

  // Manage open/close lifecycle
  React.useEffect(() => {
    if (open && (phase === 'closed' || phase === 'closing')) {
      setDragY(0);
      setIsDragging(false);
      setCurrentSnap(initialSnap);
      setPhase('entering');
    } else if (!open && phase !== 'closed') {
      setPhase('closing');
    }
  }, [open]);

  // Handle escape key
  React.useEffect(() => {
    if (phase === 'closed') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [phase]);

  // Body scroll lock
  React.useEffect(() => {
    if (phase === 'closed') return;

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    const prevTouchAction = document.body.style.touchAction;
    const prevPosition = document.body.style.position;
    const prevWidth = document.body.style.width;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
      document.body.style.touchAction = prevTouchAction;
      document.body.style.position = prevPosition;
      document.body.style.width = prevWidth;
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    };
  }, [phase]);

  const handleClose = React.useCallback(() => {
    setPhase('closing');
  }, []);

  const handleTransitionEnd = React.useCallback(() => {
    if (phase === 'closing') {
      setPhase('closed');
      setDragY(0);
      onOpenChange(false);
    }
  }, [phase, onOpenChange]);

  const handleAnimationEnd = React.useCallback(() => {
    if (phase === 'entering') {
      setPhase('open');
    }
  }, [phase]);

  // Find nearest snap point to a given height
  const findNearestSnap = React.useCallback((heightPx: number): SnapPoint | null => {
    const vh = window.innerHeight;
    const ratio = heightPx / vh;

    // If dragged below lowest snap minus threshold, dismiss
    if (ratio < lowestSnap - (DISMISS_THRESHOLD / vh)) {
      return null; // signals dismiss
    }

    let nearest = sortedSnaps[0];
    let minDist = Math.abs(ratio - sortedSnaps[0]);
    for (const snap of sortedSnaps) {
      const dist = Math.abs(ratio - snap);
      if (dist < minDist) {
        minDist = dist;
        nearest = snap;
      }
    }
    return nearest;
  }, [sortedSnaps, lowestSnap]);

  // Drag handlers on the drag handle
  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartTime.current = Date.now();
    setIsDragging(true);
  }, []);

  const onTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    setDragY(delta);
  }, [isDragging]);

  const onTouchEnd = React.useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Calculate velocity for flick detection
    const elapsed = Date.now() - dragStartTime.current;
    const velocity = Math.abs(dragY) / Math.max(elapsed, 1); // px/ms

    const newHeightPx = currentHeight - dragY;

    // Fast upward flick → snap to next higher point
    if (velocity > SNAP_VELOCITY_THRESHOLD && dragY < -20) {
      const currentIdx = sortedSnaps.indexOf(currentSnap);
      const nextSnap = sortedSnaps[Math.min(currentIdx + 1, sortedSnaps.length - 1)];
      setCurrentSnap(nextSnap);
      setDragY(0);
      return;
    }

    // Fast downward flick → snap to next lower point (or dismiss)
    if (velocity > SNAP_VELOCITY_THRESHOLD && dragY > 20) {
      const currentIdx = sortedSnaps.indexOf(currentSnap);
      if (currentIdx === 0) {
        handleClose();
        return;
      }
      const prevSnap = sortedSnaps[Math.max(currentIdx - 1, 0)];
      setCurrentSnap(prevSnap);
      setDragY(0);
      return;
    }

    // Slow drag — snap to nearest
    const nearestSnap = findNearestSnap(newHeightPx);
    if (nearestSnap === null) {
      handleClose();
    } else {
      setCurrentSnap(nearestSnap);
      setDragY(0);
    }
  }, [isDragging, dragY, currentHeight, currentSnap, sortedSnaps, findNearestSnap, handleClose]);

  if (phase === 'closed') return null;

  // Compute sheet height and transform
  const targetHeight = currentHeight;
  let sheetStyle: React.CSSProperties;

  if (phase === 'entering') {
    sheetStyle = {
      height: `${targetHeight}px`,
      animation: 'slideUp 250ms ease-out',
    };
  } else if (phase === 'closing') {
    sheetStyle = {
      height: `${targetHeight}px`,
      transform: 'translateY(100%)',
      transition: 'transform 200ms ease-in',
    };
  } else if (isDragging && dragY !== 0) {
    // During drag, adjust height live
    const draggedHeight = Math.max(0, targetHeight - dragY);
    sheetStyle = {
      height: `${draggedHeight}px`,
      transition: 'none',
    };
  } else {
    sheetStyle = {
      height: `${targetHeight}px`,
      transition: 'height 250ms cubic-bezier(0.32, 0.72, 0, 1)',
    };
  }

  const backdropOpacity = isDragging && dragY > 0 ? Math.max(0, 1 - dragY / 300) : undefined;

  // Snap indicator dots
  const snapIndicator = (
    <div className="flex gap-1 justify-center py-1">
      {sortedSnaps.map((snap) => (
        <button
          key={snap}
          onClick={() => setCurrentSnap(snap)}
          className={`w-1.5 h-1.5 rounded-full transition-all duration-200 compact-btn ${
            snap === currentSnap
              ? 'bg-foreground/50 scale-125'
              : 'bg-foreground/15 hover:bg-foreground/25'
          }`}
          aria-label={`Snap to ${Math.round(snap * 100)}%`}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{
          animation: phase === 'entering' ? 'fadeIn 200ms ease-out' : undefined,
          opacity: phase === 'closing' ? 0 : backdropOpacity,
          transition: phase === 'closing' ? 'opacity 200ms ease-in' : undefined,
        }}
        onClick={handleClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-2xl border-t border-slate-700 bg-slate-900/95 shadow-xl overflow-y-auto overscroll-none flex flex-col"
        style={{ ...sheetStyle, touchAction: 'pan-y' }}
        onAnimationEnd={handleAnimationEnd}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Drag handle with snap indicator */}
        <div
          className="sticky top-0 z-10 bg-slate-900/95 rounded-t-2xl flex-shrink-0"
          style={{ touchAction: 'none' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex justify-center pt-3 pb-1 cursor-grab">
            <div className="w-10 h-1 rounded-full bg-slate-600" />
          </div>
          {snapPoints.length > 1 && snapIndicator}
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

interface BottomSheetSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const BottomSheetHeader: React.FC<BottomSheetSectionProps & { onClose?: () => void }> = ({
  children,
  className = "",
  onClose,
}) => (
  <div className={"sticky top-0 z-10 bg-slate-900/95 flex items-center justify-between px-4 pb-3 pt-1 " + className}>
    <div className="flex items-center gap-3 min-w-0">{children}</div>
    {onClose && (
      <button
        onClick={onClose}
        className="p-1.5 hover:bg-secondary/10 rounded-md transition-colors flex-shrink-0 compact-btn"
        aria-label="Close"
      >
        <X className="w-5 h-5 text-muted-foreground" />
      </button>
    )}
  </div>
);

export const BottomSheetContent: React.FC<BottomSheetSectionProps> = ({
  children,
  className = "",
}) => (
  <div className={"px-4 pb-6 " + className}>{children}</div>
);
