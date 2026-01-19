import * as React from "react";

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ orientation = "horizontal", className = "", ...props }, ref) => {
    const isVertical = orientation === "vertical";

    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation}
        className={
          (isVertical
            ? "mx-2 h-full w-px"
            : "my-3 h-px w-full") +
          " bg-slate-800 " +
          className
        }
        {...props}
      />
    );
  }
);

Separator.displayName = "Separator";

export default Separator;