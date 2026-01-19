import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={
        "flex h-9 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs text-slate-100 shadow-sm outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 " +
        className
      }
      {...props}
    />
  )
);

Input.displayName = "Input";

export default Input;