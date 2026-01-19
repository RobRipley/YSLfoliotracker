import * as React from "react";

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={
        "h-4 w-4 rounded border border-slate-600 bg-slate-900 text-indigo-500 focus:ring-1 focus:ring-indigo-400 focus:outline-none " +
        "disabled:cursor-not-allowed disabled:opacity-50 " +
        className
      }
      {...props}
    />
  )
);

Checkbox.displayName = "Checkbox";

export default Checkbox;