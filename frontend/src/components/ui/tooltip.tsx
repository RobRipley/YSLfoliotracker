import * as React from "react";

export interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, ...props }) => {
  return <div {...props}>{children}</div>;
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
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, props as any);
  }
  return <div {...props}>{children}</div>;
};

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const TooltipContent: React.FC<TooltipContentProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div
      className={
        "absolute z-50 rounded-lg border border-slate-700 bg-slate-900/95 px-2 py-1 text-[11px] text-slate-100 shadow-lg " +
        className
      }
      {...props}
    >
      {children}
    </div>
  );
};
