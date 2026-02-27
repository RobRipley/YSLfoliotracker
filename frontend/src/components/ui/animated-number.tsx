import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatFn?: (value: number) => string;
  className?: string;
}

/**
 * Animated number counter that smoothly transitions between values.
 * Uses requestAnimationFrame for smooth 60fps animation.
 * Spring-like easing for a premium feel.
 */
export function AnimatedNumber({
  value,
  duration = 600,
  formatFn = (v) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  className,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startValueRef = useRef<number>(value);

  useEffect(() => {
    const from = previousValueRef.current;
    const to = value;

    // Skip animation if values are the same or it's the first render with 0
    if (from === to) return;
    if (from === 0 && to > 0) {
      // First meaningful value — just set it (or animate from 0)
      startValueRef.current = 0;
    } else {
      startValueRef.current = from;
    }

    previousValueRef.current = to;

    // Cancel any existing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      const current = startValueRef.current + (to - startValueRef.current) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(to);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {formatFn(displayValue)}
    </span>
  );
}
