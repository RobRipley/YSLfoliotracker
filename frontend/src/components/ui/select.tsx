import * as React from "react";
import { ChevronDown } from "lucide-react";

type SelectContextType = {
  value: string | undefined;
  setValue: (v: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  placeholder?: string;
};

const SelectContext = React.createContext<SelectContextType | null>(null);

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  value,
  defaultValue,
  onValueChange,
  className = "",
  children,
}) => {
  const [internalValue, setInternalValue] = React.useState<string | undefined>(
    defaultValue
  );
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const actualValue = value !== undefined ? value : internalValue;

  const setValue = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <SelectContext.Provider
      value={{ value: actualValue, setValue, open, setOpen, placeholder: undefined }}
    >
      <div ref={containerRef} className={`relative ${className}`}>{children}</div>
    </SelectContext.Provider>
  );
};

type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const SelectTrigger: React.FC<SelectTriggerProps> = ({
  className = "",
  children,
  ...props
}) => {
  const ctx = React.useContext<SelectContextType | null>(SelectContext);
  if (!ctx) throw new Error("SelectTrigger must be used within Select");

  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={
        "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-divide-lighter/30 bg-secondary/10 px-3 text-xs text-foreground/90 " +
        "hover:border-divide-lighter/50 hover:bg-secondary/15 transition-colors duration-150 " +
        "focus:border-primary/50 focus:ring-1 focus:ring-primary/30 focus:outline-none " +
        className
      }
      {...props}
    >
      {children}
      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-150 ${ctx.open ? 'rotate-180' : ''}`} />
    </button>
  );
};

interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export const SelectValue: React.FC<SelectValueProps> = ({
  placeholder,
  className = "",
}) => {
  const ctx = React.useContext<SelectContextType | null>(SelectContext);
  if (!ctx) throw new Error("SelectValue must be used within Select");

  const text = ctx.value 
    ? ctx.value.charAt(0).toUpperCase() + ctx.value.slice(1) 
    : placeholder || "Select";

  return (
    <span className={"text-xs text-foreground/90 " + className}>{text}</span>
  );
};

type SelectContentProps = React.HTMLAttributes<HTMLDivElement>;

export const SelectContent: React.FC<SelectContentProps> = ({
  className = "",
  children,
  ...props
}) => {
  const ctx = React.useContext<SelectContextType | null>(SelectContext);
  if (!ctx) throw new Error("SelectContent must be used within Select");

  if (!ctx.open) return null;

  return (
    <div
      className={
        "absolute top-full left-0 mt-1 min-w-full max-h-64 overflow-auto rounded-lg border border-divide-lighter/30 bg-background/95 backdrop-blur-sm p-1 text-xs shadow-lg z-50 " +
        "animate-in fade-in-0 zoom-in-95 duration-100 " +
        className
      }
      {...props}
    >
      {children}
    </div>
  );
};

interface SelectItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const SelectItem: React.FC<SelectItemProps> = ({
  value,
  className = "",
  children,
  ...props
}) => {
  const ctx = React.useContext<SelectContextType | null>(SelectContext);
  if (!ctx) throw new Error("SelectItem must be used within Select");

  const active = ctx.value === value;

  return (
    <button
      type="button"
      onClick={() => {
        ctx.setValue(value);
        ctx.setOpen(false);
      }}
      className={
        "flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-100 " +
        (active 
          ? "bg-primary/20 text-foreground font-medium" 
          : "text-foreground/80 hover:bg-secondary/30 hover:text-foreground") +
        " " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
};
