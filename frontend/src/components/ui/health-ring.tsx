import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface HealthRingProps {
  /** Diversification score 0-100 (how spread across categories) */
  diversification: number;
  /** Exit readiness 0-100 (% of holdings with exit plans) */
  exitReadiness: number;
  /** PnL trend: positive, negative, or flat */
  pnlTrend: 'up' | 'down' | 'flat';
  /** Overall score (auto-computed if not provided) */
  overallScore?: number;
  size?: number;
  className?: string;
}

/**
 * Portfolio Health Ring — a single SVG ring synthesizing:
 *   - Diversification score (how spread your allocation is)
 *   - Exit readiness (% of positions with exit plans)
 *   - PnL trend (overall direction)
 *
 * Renders as a circular progress arc with a numeric score in the center.
 */
export function HealthRing({
  diversification,
  exitReadiness,
  pnlTrend,
  overallScore: overallScoreProp,
  size = 72,
  className,
}: HealthRingProps) {
  const overallScore = overallScoreProp ?? Math.round(
    diversification * 0.4 + exitReadiness * 0.4 + (pnlTrend === 'up' ? 20 : pnlTrend === 'flat' ? 10 : 0)
  );

  const normalizedScore = Math.max(0, Math.min(100, overallScore));

  const { color, label } = useMemo(() => {
    if (normalizedScore >= 75) return { color: '#34d399', label: 'Strong' };
    if (normalizedScore >= 50) return { color: '#fbbf24', label: 'Fair' };
    if (normalizedScore >= 25) return { color: '#f97316', label: 'Weak' };
    return { color: '#ef4444', label: 'At Risk' };
  }, [normalizedScore]);

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalizedScore / 100) * circumference;
  const center = size / 2;

  return (
    <div className={cn('relative inline-flex flex-col items-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={4}
          strokeOpacity={0.3}
        />
        {/* Progress ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 800ms ease-out, stroke 300ms ease-out',
          }}
        />
      </svg>
      {/* Center score */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-base font-bold tabular-nums"
          style={{ color }}
        >
          {normalizedScore}
        </span>
      </div>
      <span className="text-[9px] text-muted-foreground/50 mt-0.5 uppercase tracking-wider font-medium">
        {label}
      </span>
    </div>
  );
}

/**
 * Compute diversification score from category allocations.
 * Uses a simplified Herfindahl–Hirschman Index (HHI) inverted to 0-100.
 * More equally distributed = higher score.
 */
export function computeDiversificationScore(
  byCategory: Record<string, number>,
  totalValue: number,
): number {
  if (totalValue <= 0) return 0;
  const shares = Object.values(byCategory)
    .filter(v => v > 0)
    .map(v => v / totalValue);

  if (shares.length <= 1) return 10; // Only one category = low diversification

  // HHI ranges from 1/n (perfectly equal) to 1 (fully concentrated)
  const hhi = shares.reduce((sum, s) => sum + s * s, 0);
  const n = shares.length;
  const minHHI = 1 / n;
  const maxHHI = 1;

  // Invert: 0 = fully concentrated, 100 = perfectly equal
  const score = ((maxHHI - hhi) / (maxHHI - minHHI)) * 100;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Compute exit readiness: what % of non-stablecoin holdings have exit plans.
 */
export function computeExitReadiness(
  holdingCount: number,
  holdingsWithExitPlans: number,
): number {
  if (holdingCount <= 0) return 0;
  return Math.round((holdingsWithExitPlans / holdingCount) * 100);
}
