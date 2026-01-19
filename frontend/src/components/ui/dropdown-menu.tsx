// frontend/src/components/ui/dropdown-menu.tsx
import * as React from "react";

type DropdownMenuProps = {
  children: React.ReactNode;
};

export function DropdownMenu({ children }: DropdownMenuProps) {
  return (
    <div className="relative inline-block text-left">
      {children}
    </div>
  );
}

type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export function DropdownMenuTrigger({
  children,
  className = "",
  ...props
}: TriggerProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

type ContentProps = {
  children: React.ReactNode;
  className?: string;
};

export function DropdownMenuContent({
  children,
  className = "",
}: ContentProps) {
  return (
    <div
      className={`absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg focus:outline-none ${className}`}
      role="menu"
    >
      {children}
    </div>
  );
}

type BaseItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export function DropdownMenuItem({
  children,
  className = "",
  ...props
}: BaseItemProps) {
  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground ${className}`}
      role="menuitem"
      {...props}
    >
      {children}
    </button>
  );
}

type CheckboxItemProps = BaseItemProps & {
  checked?: boolean;
};

export function DropdownMenuCheckboxItem({
  children,
  checked,
  className = "",
  ...props
}: CheckboxItemProps) {
  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground ${className}`}
      role="menuitemcheckbox"
      aria-checked={checked}
      {...props}
    >
      <span
        className={`inline-flex h-3 w-3 items-center justify-center rounded-sm border ${
          checked ? "bg-primary text-primary-foreground" : "bg-background"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}