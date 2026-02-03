// frontend/src/components/ui/slider.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  // Support both Radix-style array and standard number value
  value?: number | number[];
  // Support both Radix-style onValueChange and standard onChange
  onValueChange?: (value: number[]) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className = "", value, onValueChange, onChange, ...props }, ref) => {
    // Normalize value: Radix uses arrays, HTML input uses numbers
    const normalizedValue = Array.isArray(value) ? value[0] : value;
    
    // Handle change: support both APIs
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      
      // Call Radix-style onValueChange if provided
      if (onValueChange) {
        onValueChange([newValue]);
      }
      
      // Also call standard onChange if provided
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <input
        ref={ref}
        type="range"
        value={normalizedValue}
        onChange={handleChange}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary/50",
          // WebKit (Chrome, Safari, Edge) thumb styling
          "[&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5",
          "[&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:bg-white",
          "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary",
          "[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(var(--primary),0.2)]",
          "[&::-webkit-slider-thumb]:cursor-pointer",
          "[&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-150",
          "[&::-webkit-slider-thumb]:hover:shadow-[0_0_0_6px_rgba(var(--primary),0.3)]",
          // Firefox thumb styling
          "[&::-moz-range-thumb]:appearance-none",
          "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5",
          "[&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-white",
          "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary",
          "[&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(var(--primary),0.2)]",
          "[&::-moz-range-thumb]:cursor-pointer",
          "[&::-moz-range-thumb]:border-0",
          // Track styling
          "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full",
          "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full",
          className
        )}
        {...props}
      />
    );
  }
);

Slider.displayName = "Slider";
