import * as React from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const DISMISS_THRESHOLD = 60; // px dragged down to trigger close

/**
 * BottomSheet component for mobile progressive disclosure.
 * Slides up from the bottom of the screen with a backdrop overlay.
 * Supports drag-to-dismiss: grab the drag handle and pull down to close.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ open, onOpenChange, children }) => {
  const [phase, setPhase] = React.useState<'entering' | 'open' | 'closing' | 'closed'>('closed');
  const [dragY, setDragY] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartY = React.useRef(0);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  // Manage open/close lifecycle
  React.useEffect(() => {
    if (open && (phase === 'closed' || phase === 'closing')) {
      setDragY(0);
      setIsDragging(false);
      setPhase('entering');
    } else if (!open && phase !== 'closed') {
      setPhase('closed');
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

  // Body scroll lock — prevent background page scrolling & pull-to-refresh
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
    // Fix iOS Safari scroll bleed: pin the body in place
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

  // After close animation/transition ends, actually unmount
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

  // Drag-to-dismiss touch handlers (on the drag handle area only)
  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const onTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    // Only allow dragging downward
    if (delta > 0) {
      setDragY(delta);
    }
  }, [isDragging]);

  const onTouchEnd = React.useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > DISMISS_THRESHOLD) {
      // Dismiss — slide to bottom from current position (no flash)
      handleClose();
    } else {
      // Snap back
      setDragY(0);
    }
  }, [isDragging, dragY, handleClose]);

  if (phase === 'closed') return null;

  // Compute sheet transform
  let sheetStyle: React.CSSProperties;
  if (phase === 'entering') {
    sheetStyle = { animation: 'slideUp 250ms ease-out' };
  } else if (phase === 'closing') {
    // Slide from current position to off-screen — no flash
    sheetStyle = {
      transform: 'translateY(100%)',
      transition: 'transform 200ms ease-in',
    };
  } else if (dragY > 0) {
    sheetStyle = {
      transform: `translateY(${dragY}px)`,
      transition: isDragging ? 'none' : 'transform 200ms ease-out',
    };
  } else {
    sheetStyle = {};
  }

  const backdropOpacity = dragY > 0 ? Math.max(0, 1 - dragY / 300) : undefined;
  const isClosingOrDragging = phase === 'closing' || dragY > 0;

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
        className="fixed bottom-0 left-0 right-0 z-[60] max-h-[85vh] rounded-t-2xl border-t border-slate-700 bg-slate-900/95 shadow-xl overflow-y-auto overscroll-none"
        style={{ ...sheetStyle, touchAction: 'pan-y' }}
        onAnimationEnd={handleAnimationEnd}
        onTransitionEnd={handleTransitionEnd}
      >
        {/* Drag handle — touch target for drag-to-dismiss */}
        <div
          className="sticky top-0 z-10 bg-slate-900/95 rounded-t-2xl"
          style={{ touchAction: 'none' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex justify-center pt-3 pb-2 cursor-grab">
            <div className="w-10 h-1 rounded-full bg-slate-600" />
          </div>
        </div>
        {children}
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
  <div className={"sticky top-8 z-10 bg-slate-900/95 flex items-center justify-between px-4 pb-3 pt-1 " + className}>
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
