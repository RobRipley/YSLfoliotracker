// frontend/src/components/ui/scroll-area.tsx
import * as React from "react";

export interface ScrollAreaProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional maximum height in pixels.
   * If provided, the content will scroll vertically when it exceeds this height.
   */
  maxHeight?: number;
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className = "", style, maxHeight, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={
          "relative w-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 " +
          className
        }
        style={{
          maxHeight: maxHeight ?? 320,
          ...style,
        }}
        {...props}
      >
        <div className="p-3">{children}</div>
      </div>
    );
  }
);

ScrollArea.displayName = "ScrollArea";