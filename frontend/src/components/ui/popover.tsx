import * as React from "react";

type PopoverContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  registerContent: (el: HTMLElement | null) => void;
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
  const contentRef = React.useRef<HTMLElement | null>(null);

  const actualOpen = open !== undefined ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const registerContent = React.useCallback((el: HTMLElement | null) => {
    contentRef.current = el;
  }, []);

  // Close on click outside
  React.useEffect(() => {
    if (!actualOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = containerRef.current && containerRef.current.contains(target);
      const clickedInsideContent = contentRef.current && contentRef.current.contains(target);
      
      if (!clickedInsideTrigger && !clickedInsideContent) {
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

  // When popover opens, add z-index to the nearest Card ancestor
  React.useEffect(() => {
    if (!actualOpen || !containerRef.current) return;

    // Find the nearest Card ancestor (has class containing 'rounded-2xl' or data attribute)
    let cardElement: HTMLElement | null = containerRef.current;
    while (cardElement && !cardElement.classList.contains('glass-panel')) {
      cardElement = cardElement.parentElement;
    }

    if (cardElement) {
      const originalZIndex = cardElement.style.zIndex;
      const originalPosition = cardElement.style.position;
      cardElement.style.zIndex = '100';
      cardElement.style.position = 'relative';

      return () => {
        if (cardElement) {
          cardElement.style.zIndex = originalZIndex;
          cardElement.style.position = originalPosition;
        }
      };
    }
  }, [actualOpen]);

  return (
    <PopoverContext.Provider value={{ open: actualOpen, setOpen, registerContent }}>
      <div 
        ref={containerRef} 
        className={"relative inline-block " + className}
      >
        {children}
      </div>
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
      'data-popover-trigger': true,
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
      data-popover-trigger
      onClick={() => ctx.setOpen(!ctx.open)}
      className={className}
    >
      {children}
    </button>
  );
};

export interface PopoverContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
  sideOffset?: number;
}

export const PopoverContent: React.FC<PopoverContentProps> = ({
  className = "",
  children,
  style,
  align = 'end',
  side = 'bottom',
  sideOffset = 8,
  ...props
}) => {
  const ctx = React.useContext(PopoverContext);
  const contentRef = React.useRef<HTMLDivElement>(null);
  
  if (!ctx) throw new Error("PopoverContent must be used inside <Popover>");

  // Register content ref with parent Popover for click-outside detection
  React.useEffect(() => {
    ctx.registerContent(contentRef.current);
    return () => ctx.registerContent(null);
  }, [ctx.open]);

  if (!ctx.open) return null;

  // Calculate alignment styles
  const alignmentStyles: React.CSSProperties = {
    position: 'absolute',
    top: side === 'bottom' ? `calc(100% + ${sideOffset}px)` : undefined,
    bottom: side === 'top' ? `calc(100% + ${sideOffset}px)` : undefined,
    left: align === 'start' ? 0 : undefined,
    right: align === 'end' ? 0 : undefined,
  };

  if (align === 'center') {
    alignmentStyles.left = '50%';
    alignmentStyles.transform = 'translateX(-50%)';
  }

  // Render inline (not portal) so it scrolls with content
  // Parent Card gets z-index bump when popover is open
  return (
    <div
      ref={contentRef}
      className={
        "z-[50] rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-100 shadow-2xl " +
        className
      }
      style={{ 
        ...alignmentStyles,
        ...style 
      }}
      {...props}
    >
      {children}
    </div>
  );
};
