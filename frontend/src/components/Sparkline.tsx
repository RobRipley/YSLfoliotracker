import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { type PortfolioSnapshot } from '@/lib/dataModel';

interface SparklineProps {
  snapshots: PortfolioSnapshot[];
  width?: number;
  height?: number;
}

export function Sparkline({ snapshots, width = 56, height = 32 }: SparklineProps) {
  // Get last 30 days of data
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSnapshots = snapshots
    .filter(s => s.timestamp >= thirtyDaysAgo)
    .map(s => ({ value: s.totalValue }));

  if (recentSnapshots.length === 0) {
    return <div style={{ width, height }} className="bg-muted/20 rounded" />;
  }

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={recentSnapshots}>
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="oklch(0.6 0.118 184.704)" 
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
