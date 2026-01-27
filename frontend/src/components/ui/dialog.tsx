import * as React from "react";

type DialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

/**
 * Dialog component with proper open/close state management.
 * Renders a modal overlay when open is true.
 */

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  // Handle escape key to close
  React.useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange?.(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Don't render anything if not open
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      {/* Content wrapper */}
      <div className="relative z-50">
        {children}
      </div>
    </div>
  );
};

type DialogSectionProps = {
  children: React.ReactNode;
  className?: string;
};

export const DialogContent: React.FC<DialogSectionProps> = ({
  children,
  className = "",
}) => (
  <div
    className={
      "rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-xl max-h-[85vh] overflow-y-auto " +
      className
    }
  >
    {children}
  </div>
);

export const DialogHeader: React.FC<DialogSectionProps> = ({
  children,
  className = "",
}) => (
  <div className={"mb-3 space-y-1 " + className}>{children}</div>
);

export const DialogTitle: React.FC<DialogSectionProps> = ({
  children,
  className = "",
}) => (
  <h2 className={"text-sm font-semibold text-slate-100 " + className}>
    {children}
  </h2>
);

export const DialogDescription: React.FC<DialogSectionProps> = ({
  children,
  className = "",
}) => (
  <p className={"text-xs text-slate-400 " + className}>{children}</p>
);

export const DialogFooter: React.FC<DialogSectionProps> = ({
  children,
  className = "",
}) => (
  <div className={"mt-4 flex justify-end gap-2 " + className}>{children}</div>
);

export const DialogTrigger: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ children, className = "", ...props }) => (
  <button
    className={
      "inline-flex items-center justify-center rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-100 hover:bg-slate-800 " +
      className
    }
    {...props}
  >
    {children}
  </button>
);
