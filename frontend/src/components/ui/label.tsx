import * as React from "react";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = "", ...props }, ref) => (
    <label
      ref={ref}
      className={
        "text-xs font-medium text-slate-300 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 " +
        className
      }
      {...props}
    />
  )
);

Label.displayName = "Label";

export default Label;