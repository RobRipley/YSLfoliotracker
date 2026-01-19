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

  const actualOpen = open !== undefined ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <PopoverContext.Provider value={{ open: actualOpen, setOpen }}>
      <div className={"relative inline-block " + className}>{children}</div>
    </PopoverContext.Provider>
  );
};

export interface PopoverTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const PopoverTrigger: React.FC<PopoverTriggerProps> = ({
  className = "",
  children,
  ...props
}) => {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("PopoverTrigger must be used inside <Popover>");

  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={className}
      {...props}
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