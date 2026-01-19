import * as React from "react";

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

  const actualValue = value !== undefined ? value : internalValue;

  const setValue = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <SelectContext.Provider
      value={{ value: actualValue, setValue, open, setOpen, placeholder: undefined }}
    >
      <div className={className}>{children}</div>
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
        "flex h-9 w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-slate-100 shadow-sm " +
        "focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 " +
        className
      }
      {...props}
    >
      {children}
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

  const text = ctx.value || placeholder || "Select";

  return (
    <span className={"text-xs text-slate-200 " + className}>{text}</span>
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
        "mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-1 text-xs shadow-lg " +
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
        "flex w-full cursor-pointer items-center rounded-lg px-2 py-1 text-left text-xs " +
        (active ? "bg-indigo-500 text-white" : "text-slate-200 hover:bg-slate-800") +
        " " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
};