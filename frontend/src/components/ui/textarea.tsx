import * as React from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      className={
        "flex min-h-[80px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-sm outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 " +
        className
      }
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";

export default Textarea;