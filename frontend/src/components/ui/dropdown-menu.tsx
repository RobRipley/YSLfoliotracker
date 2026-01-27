// frontend/src/components/ui/dropdown-menu.tsx
import * as React from "react";

type DropdownMenuContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextType | null>(null);

type DropdownMenuProps = {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function DropdownMenu({ children, open, defaultOpen, onOpenChange }: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(!!defaultOpen);
  const menuRef = React.useRef<HTMLDivElement>(null);
  
  const actualOpen = open !== undefined ? open : internalOpen;
  
  const setOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (actualOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [actualOpen]);

  // Close dropdown on Escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    if (actualOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [actualOpen]);

  return (
    <DropdownMenuContext.Provider value={{ open: actualOpen, setOpen }}>
      <div ref={menuRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  asChild?: boolean;
};

export function DropdownMenuTrigger({
  children,
  className = "",
  asChild,
  ...props
}: TriggerProps) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenuTrigger must be used inside <DropdownMenu>");

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    ctx.setOpen(!ctx.open);
    props.onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-expanded={ctx.open}
      aria-haspopup="menu"
      {...props}
    >
      {children}
    </button>
  );
}

type ContentProps = {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end' | 'center';
};

export function DropdownMenuContent({
  children,
  className = "",
  align = 'end',
}: ContentProps) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenuContent must be used inside <DropdownMenu>");

  if (!ctx.open) return null;

  const alignClass = align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2';

  return (
    <div
      className={`absolute ${alignClass} z-50 mt-2 w-56 origin-top-right rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg focus:outline-none ${className}`}
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
  onClick,
  ...props
}: BaseItemProps) {
  const ctx = React.useContext(DropdownMenuContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    ctx?.setOpen(false);
  };

  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground ${className}`}
      role="menuitem"
      onClick={handleClick}
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
  onClick,
  ...props
}: CheckboxItemProps) {
  // Don't close dropdown on checkbox toggle
  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground ${className}`}
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onClick}
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
