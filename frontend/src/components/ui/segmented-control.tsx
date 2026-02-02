import * as React from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// SegmentedControl - A premium segmented navigation control
// =============================================================================

export interface SegmentedTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  tabs: SegmentedTab[];
  variant?: 'default' | 'amber';
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl({
  value,
  onChange,
  tabs,
  variant = 'default',
  size = 'md',
  className,
}: SegmentedControlProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = React.useState<React.CSSProperties>({
    opacity: 0,
  });
  
  // Calculate pill position based on active tab
  const updatePillPosition = React.useCallback(() => {
    if (!containerRef.current) return;
    
    const activeIndex = tabs.findIndex(tab => tab.id === value);
    if (activeIndex === -1) return;
    
    const buttons = containerRef.current.querySelectorAll<HTMLButtonElement>('[data-segment-trigger]');
    const activeButton = buttons[activeIndex];
    
    if (!activeButton) return;
    
    // Get position relative to the container's padding box
    const containerPadding = 4; // p-1 = 4px
    let offsetLeft = containerPadding;
    
    for (let i = 0; i < activeIndex; i++) {
      offsetLeft += buttons[i].offsetWidth;
    }
    
    setPillStyle({
      width: activeButton.offsetWidth,
      height: activeButton.offsetHeight,
      transform: `translateX(${offsetLeft - containerPadding}px)`,
      opacity: 1,
    });
  }, [value, tabs]);
  
  // Update on mount and value change
  React.useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(updatePillPosition, 10);
    return () => clearTimeout(timer);
  }, [updatePillPosition]);
  
  // Recalculate on resize
  React.useEffect(() => {
    window.addEventListener('resize', updatePillPosition);
    return () => window.removeEventListener('resize', updatePillPosition);
  }, [updatePillPosition]);

  const isAmber = variant === 'amber';
  const isSmall = size === 'sm';

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center rounded-full p-1",
        "bg-secondary/40 border border-border/50",
        "backdrop-blur-sm w-fit",
        className
      )}
      role="tablist"
    >
      {/* Animated pill background */}
      <div
        className={cn(
          "absolute top-1 left-1 rounded-full",
          "transition-all duration-200 ease-out",
          isAmber
            ? "bg-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            : "bg-primary/15 shadow-[0_0_12px_rgba(6,182,212,0.12)]"
        )}
        style={pillStyle}
        aria-hidden="true"
      />
      
      {/* Tab buttons */}
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        
        return (
          <button
            key={tab.id}
            data-segment-trigger
            onClick={() => onChange(tab.id)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "relative z-10 flex items-center gap-2 rounded-full font-medium",
              "transition-colors duration-150 ease-out",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              // Size variants
              isSmall 
                ? "px-3 py-1.5 text-[13px] tracking-[-0.01em]" 
                : "px-4 py-2 text-[14px] tracking-[-0.01em]",
              // Color variants
              isActive
                ? isAmber
                  ? "text-amber-400"
                  : "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            {tab.icon && (
              <span className={cn(
                "transition-colors duration-150",
                isActive
                  ? isAmber
                    ? "text-amber-400"
                    : "text-primary"
                  : "text-muted-foreground"
              )}>
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
