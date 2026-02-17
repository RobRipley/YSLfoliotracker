import * as React from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const DISMISS_THRESHOLD = 100; // px dragged down to trigger close

/**
 * BottomSheet component for mobile progressive disclosure.
 * Slides up from the bottom of the screen with a backdrop overlay.
 * Supports drag-to-dismiss: grab the drag handle and pull down to close.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ open, onOpenChange, children }) => {
  const [closing, setClosing] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartY = React.useRef(0);
  const sheetRef = React.useRef<HTMLDivElement>(null);

  // Handle escape key
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Body scroll lock
  React.useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Reset drag state when sheet opens
  React.useEffect(() => {
    if (open) {
      setDragY(0);
      setIsDragging(false);
      setClosing(false);
    }
  }, [open]);

  const handleClose = React.useCallback(() => {
    setClosing(true);
  }, []);

  const handleAnimationEnd = React.useCallback(() => {
    if (closing) {
      setClosing(false);
      setDragY(0);
      onOpenChange(false);
    }
  }, [closing, onOpenChange]);

  // Drag-to-dismiss touch handlers (on the drag handle area)
  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    // Only allow drag when sheet is scrolled to top
    if (sheetRef.current && sheetRef.current.scrollTop > 0) return;
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const onTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    // Only allow dragging downward
    if (delta > 0) {
      setDragY(delta);
      // Prevent scroll while dragging
      e.preventDefault();
    }
  }, [isDragging]);

  const onTouchEnd = React.useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > DISMISS_THRESHOLD) {
      // Dismiss
      handleClose();
    } else {
      // Snap back
      setDragY(0);
    }
  }, [isDragging, dragY, handleClose]);

  if (!open) return null;

  const sheetStyle: React.CSSProperties = {
    ...(closing
      ? { animation: 'slideDown 200ms ease-in forwards' }
      : dragY > 0
        ? { transform: `translateY(${dragY}px)`, transition: isDragging ? 'none' : 'transform 200ms ease-out' }
        : { animation: 'slideUp 250ms ease-out' }
    ),
  };

  const backdropOpacity = dragY > 0 ? Math.max(0, 1 - dragY / 400) : undefined;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{
          animation: closing ? 'fadeOut 200ms ease-out forwards' : (dragY > 0 ? undefined : 'fadeIn 200ms ease-out'),
          opacity: backdropOpacity,
        }}
        onClick={handleClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-[60] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900/95 shadow-xl"
        style={sheetStyle}
        onAnimationEnd={handleAnimationEnd}
      >
        {/* Drag handle + header — sticky so X is always visible */}
        <div
          className="sticky top-0 z-10 bg-slate-900/95 rounded-t-2xl"
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
