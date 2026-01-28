import * as React from "react";

type PopoverContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const PopoverContext = React.createContext<PopoverContextType | null>(null);

export interface PopoverProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export const Popover: React.FC<PopoverProps> = ({
  children,
  open,
  defaultOpen,
  onOpenChange,
  className = "",
}) => {
  const [internalOpen, setInternalOpen] = React.useState(!!defaultOpen);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const actualOpen = open !== undefined ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Close on click outside
  React.useEffect(() => {
    if (!actualOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    // Delay adding listener to avoid immediate close on the same click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [actualOpen]);

  return (
    <PopoverContext.Provider value={{ open: actualOpen, setOpen }}>
      <div ref={containerRef} className={"relative inline-block " + className}>{children}</div>
    </PopoverContext.Provider>
  );
};

export interface PopoverTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

export const PopoverTrigger: React.FC<PopoverTriggerProps> = ({
  className = "",
  children,
  asChild,
}) => {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("PopoverTrigger must be used inside <Popover>");

  // If asChild, clone the child element and add onClick
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        ctx.setOpen(!ctx.open);
        // Call original onClick if it exists
        const originalOnClick = (children as React.ReactElement<any>).props.onClick;
        if (originalOnClick) originalOnClick(e);
      },
    });
  }

  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={className}
    >
      {children}
    </button>
  );
};

export interface PopoverContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const PopoverContent: React.FC<PopoverContentProps> = ({
  className = "",
  children,
  style,
  ...props
}) => {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("PopoverContent must be used inside <Popover>");

  if (!ctx.open) return null;

  return (
    <div
      className={
        "absolute z-50 mt-2 min-w-[10rem] rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-lg " +
        className
      }
      style={{ right: 0, ...style }}
      {...props}
    >
      {children}
    </div>
  );
};
