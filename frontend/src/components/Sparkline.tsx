import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { type PortfolioSnapshot } from '@/lib/dataModel';

interface SparklineProps {
  snapshots: PortfolioSnapshot[];
  width?: number;
  height?: number;
}

export function Sparkline({ snapshots, width = 56, height = 32 }: SparklineProps) {
  // Get last 30 days of data
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSnapshots = useMemo(
    () =>
      snapshots
        .filter(s => s.timestamp >= thirtyDaysAgo)
        .map(s => ({ value: s.totalValue })),
    [snapshots]
  );

  // Determine trend: is last value > first value?
  const trend = useMemo(() => {
    if (recentSnapshots.length < 2) return 'neutral';
    const first = recentSnapshots[0].value;
    const last = recentSnapshots[recentSnapshots.length - 1].value;
    if (last > first * 1.001) return 'up';
    if (last < first * 0.999) return 'down';
    return 'neutral';
  }, [recentSnapshots]);

  if (recentSnapshots.length === 0) {
    return <div style={{ width, height }} className="bg-muted/20 rounded" />;
  }

  // Color based on trend
  const strokeColor = trend === 'up'
    ? '#34d399'  // emerald-400
    : trend === 'down'
      ? '#f87171'  // red-400
      : '#94a3b8'; // slate-400

  const fillColor = trend === 'up'
    ? 'rgba(52, 211, 153, 0.08)'
    : trend === 'down'
      ? 'rgba(248, 113, 113, 0.08)'
      : 'rgba(148, 163, 184, 0.05)';

  return (
    <div style={{ width, height }} className="stagger-item" >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={recentSnapshots}>
          <defs>
            <linearGradient id={`sparkGrad-${trend}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.15} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${trend})`}
            dot={false}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
