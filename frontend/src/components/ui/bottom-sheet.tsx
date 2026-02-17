import * as React from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

/**
 * BottomSheet component for mobile progressive disclosure.
 * Slides up from the bottom of the screen with a backdrop overlay.
 * Follows the same patterns as the existing Dialog component.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ open, onOpenChange, children }) => {
  const [closing, setClosing] = React.useState(false);

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

  const handleClose = React.useCallback(() => {
    setClosing(true);
  }, []);

  const handleAnimationEnd = React.useCallback(() => {
    if (closing) {
      setClosing(false);
      onOpenChange(false);
    }
  }, [closing, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{ animation: closing ? 'fadeOut 200ms ease-out forwards' : 'fadeIn 200ms ease-out' }}
        onClick={handleClose}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900/95 shadow-xl"
        style={{ animation: closing ? 'slideDown 200ms ease-in forwards' : 'slideUp 250ms ease-out' }}
        onAnimationEnd={handleAnimationEnd}
      >
        {/* Drag handle */}
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-1 bg-slate-900/95 rounded-t-2xl">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
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
  <div className={"flex items-center justify-between px-4 pb-3 " + className}>
    <div className="flex items-center gap-3 min-w-0">{children}</div>
    {onClose && (
      <button
        onClick={onClose}
        className="p-1.5 hover:bg-secondary/10 rounded-md transition-colors flex-shrink-0"
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
