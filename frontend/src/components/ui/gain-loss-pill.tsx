import { cn } from '@/lib/utils';

interface GainLossPillProps {
  value: number;
  format?: 'percent' | 'currency' | 'raw';
  showArrow?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/**
 * Consistent gain/loss indicator pill.
 * Wraps values in a subtle colored background for scannable consistency.
 */
export function GainLossPill({
  value,
  format = 'percent',
  showArrow = true,
  size = 'xs',
  className,
}: GainLossPillProps) {
  const isPositive = value >= 0;
  const isZero = Math.abs(value) < 0.01;

  const formatValue = () => {
    const prefix = isPositive && !isZero ? '+' : '';
    switch (format) {
      case 'percent':
        return `${prefix}${value.toFixed(1)}%`;
      case 'currency':
        return `${prefix}$${Math.abs(value).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      case 'raw':
        return `${prefix}${value.toFixed(2)}`;
    }
  };

  const arrow = isZero ? '' : isPositive ? '▲' : '▼';

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-medium tabular-nums whitespace-nowrap',
        sizeClasses[size],
        isZero
          ? 'bg-slate-500/10 text-slate-400'
          : isPositive
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-red-500/10 text-red-400',
        className
      )}
    >
      {showArrow && arrow && <span className="text-[0.7em]">{arrow}</span>}
      {formatValue()}
    </span>
  );
}
