// frontend/src/components/ui/slider.tsx
import * as React from "react";

export type SliderProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="range"
        className={`h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary ${className}`}
        {...props}
      />
    );
  }
);

Slider.displayName = "Slider";