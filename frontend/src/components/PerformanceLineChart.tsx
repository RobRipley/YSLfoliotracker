import { useState, useMemo, memo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type PortfolioSnapshot } from '@/lib/dataModel';

type TimeRange = '1D' | '1W' | '1M' | '3M' | 'YTD';

interface PerformanceLineChartProps {
  snapshots: PortfolioSnapshot[];
}

const CustomTooltip = memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass-panel border-divide-lighter/50 rounded-lg p-3 shadow-minimal-lg backdrop-blur-xl">
        <p className="text-xs text-muted-foreground">{data.date}</p>
        <p className="text-base font-semibold">
          ${data.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>
    );
  }
  return null;
});

CustomTooltip.displayName = 'CustomTooltip';

export const PerformanceLineChart = memo(function PerformanceLineChart({ 
  snapshots 
}: PerformanceLineChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');

  const chartData = useMemo(() => {
    const now = Date.now();
    let startTime: number;

    switch (timeRange) {
      case '1D':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case '1W':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '1M':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case '3M':
        startTime = now - 90 * 24 * 60 * 60 * 1000;
        break;
      case 'YTD':
        const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
        startTime = yearStart;
        break;
      default:
        startTime = now - 30 * 24 * 60 * 60 * 1000;
    }

    const filteredData = snapshots.filter(s => s.timestamp >= startTime);

    return filteredData.map(snapshot => ({
      timestamp: snapshot.timestamp,
      date: new Date(snapshot.timestamp).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
      totalValue: snapshot.totalValue,
    }));
  }, [snapshots, timeRange]);

  const handleRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
  }, []);

  const ranges: TimeRange[] = ['1D', '1W', '1M', '3M', 'YTD'];

  return (
    <Card className="glass-panel border-divide-lighter/50 shadow-minimal">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading">Portfolio Performance</CardTitle>
          <div className="flex gap-1">
            {ranges.map(range => (
              <button
                key={range}
                onClick={() => handleRangeChange(range)}
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  timeRange === range 
                    ? 'bg-secondary/15 text-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/8'
                }`}
                style={{ transition: 'all 150ms ease-out' }}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="rgba(75, 85, 99, 0.08)" 
                opacity={0.4}
                vertical={false}
              />
              <XAxis 
                dataKey="date" 
                stroke="rgba(156, 163, 175, 0.62)"
                style={{ fontSize: '11px' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(75, 85, 99, 0.15)' }}
              />
              <YAxis 
                stroke="rgba(156, 163, 175, 0.62)"
                style={{ fontSize: '11px' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                tickLine={false}
                axisLine={{ stroke: 'rgba(75, 85, 99, 0.15)' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="totalValue" 
                stroke="url(#lineGradient)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: '#06b6d4' }}
                animationDuration={300}
                animationEasing="ease-out"
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});
