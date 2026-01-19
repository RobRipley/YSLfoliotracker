import * as React from "react";

type CollapsibleContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CollapsibleContext = React.createContext<CollapsibleContextType | null>(
  null
);

export interface CollapsibleProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
}

export const Collapsible: React.FC<CollapsibleProps> = ({
  defaultOpen,
  open,
  onOpenChange,
  className = "",
  children,
}) => {
  const [internalOpen, setInternalOpen] = React.useState(!!defaultOpen);

  const actualOpen = open !== undefined ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (open === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <CollapsibleContext.Provider value={{ open: actualOpen, setOpen }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  );
};

type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const CollapsibleTrigger: React.FC<TriggerProps> = ({
  className = "",
  children,
  ...props
}) => {
  const ctx = React.useContext(CollapsibleContext);
  if (!ctx) throw new Error("CollapsibleTrigger must be used inside Collapsible");

  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={"flex items-center gap-1 text-xs " + className}
      {...props}
    >
      {children}
    </button>
  );
};

type ContentProps = React.HTMLAttributes<HTMLDivElement>;

export const CollapsibleContent: React.FC<ContentProps> = ({
  className = "",
  children,
  ...props
}) => {
  const ctx = React.useContext(CollapsibleContext);
  if (!ctx) throw new Error("CollapsibleContent must be used inside Collapsible");

  if (!ctx.open) return null;

  return (
    <div className={"mt-2 space-y-1 " + className} {...props}>
      {children}
    </div>
  );
};