import * as React from "react";

type TooltipContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const TooltipContext = React.createContext<TooltipContextType | null>(null);

export interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
}

export const TooltipProvider: React.FC<TooltipProviderProps> = ({ 
  children,
  delayDuration = 200 
}) => {
  return <>{children}</>;
};

export interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  children, 
  open, 
  defaultOpen,
  onOpenChange,
  delayDuration = 200,
  ...props 
}) => {
  const [internalOpen, setInternalOpen] = React.useState(!!defaultOpen);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const actualOpen = open !== undefined ? open : internalOpen;
  
  const setOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Clear timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <TooltipContext.Provider value={{ open: actualOpen, setOpen }}>
      <div className="relative inline-block" {...props}>{children}</div>
    </TooltipContext.Provider>
  );
};

export interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  children: React.ReactNode;
}

export const TooltipTrigger: React.FC<TooltipTriggerProps> = ({
  children,
  asChild,
  ...props
}) => {
  const ctx = React.useContext(TooltipContext);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleMouseEnter = () => {
    // Small delay before showing tooltip
    timeoutRef.current = setTimeout(() => {
      ctx?.setOpen(true);
    }, 150);
  };
  
  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    ctx?.setOpen(false);
  };

  const triggerProps = {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: () => ctx?.setOpen(true),
    onBlur: () => ctx?.setOpen(false),
    ...props,
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, triggerProps);
  }
  
  return <div {...triggerProps}>{children}</div>;
};

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
}

export const TooltipContent: React.FC<TooltipContentProps> = ({
  children,
  className = "",
  side = 'top',
  sideOffset = 4,
  ...props
}) => {
  const ctx = React.useContext(TooltipContext);
  
  if (!ctx?.open) return null;

  // Position classes based on side
  const positionClasses = {
    top: `bottom-full left-1/2 -translate-x-1/2 mb-${sideOffset}`,
    bottom: `top-full left-1/2 -translate-x-1/2 mt-${sideOffset}`,
    left: `right-full top-1/2 -translate-y-1/2 mr-${sideOffset}`,
    right: `left-full top-1/2 -translate-y-1/2 ml-${sideOffset}`,
  };

  return (
    <div
      role="tooltip"
      className={
        `absolute z-50 ${positionClasses[side]} rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg whitespace-nowrap ` +
        className
      }
      {...props}
    >
      {children}
    </div>
  );
};
