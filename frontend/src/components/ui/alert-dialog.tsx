// frontend/src/components/ui/alert-dialog.tsx
import * as React from "react";

type AlertDialogContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const AlertDialogContext = React.createContext<AlertDialogContextType | null>(
  null
);

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function AlertDialog({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(!!defaultOpen);

  const actualOpen = open !== undefined ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <AlertDialogContext.Provider value={{ open: actualOpen, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export function AlertDialogTrigger({
  children,
  ...props
}: TriggerProps) {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) throw new Error("AlertDialogTrigger must be used inside <AlertDialog>");

  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(true)}
      {...props}
    >
      {children}
    </button>
  );
}

type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export function AlertDialogContent({
  children,
  className = "",
  ...props
}: ContentProps) {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) throw new Error("AlertDialogContent must be used inside <AlertDialog>");

  if (!ctx.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="alertdialog"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => ctx.setOpen(false)}
      />
      <div
        className={
          "relative z-10 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-5 shadow-xl " +
          className
        }
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function AlertDialogHeader({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={"mb-3 space-y-1 " + className} {...props}>
      {children}
    </div>
  );
}

export function AlertDialogFooter({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={
        "mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end " + className
      }
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertDialogTitle({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={
        "text-sm font-semibold leading-tight text-slate-50 " + className
      }
      {...props}
    >
      {children}
    </h2>
  );
}

export function AlertDialogDescription({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={"text-xs text-slate-300 leading-relaxed " + className}
      {...props}
    >
      {children}
    </p>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export function AlertDialogAction({
  children,
  className = "",
  ...props
}: ButtonProps) {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) throw new Error("AlertDialogAction must be used inside <AlertDialog>");

  return (
    <button
      type="button"
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) ctx.setOpen(false);
      }}
      className={
        "inline-flex items-center justify-center rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

export function AlertDialogCancel({
  children,
  className = "",
  ...props
}: ButtonProps) {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) throw new Error("AlertDialogCancel must be used inside <AlertDialog>");

  return (
    <button
      type="button"
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) ctx.setOpen(false);
      }}
      className={
        "inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}