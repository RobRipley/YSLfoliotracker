import { memo, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { type Category } from '@/lib/dataModel';

const CATEGORY_LABELS: Record<Category, string> = {
  'blue-chip': 'Blue Chip',
  'mid-cap': 'Mid Cap',
  'low-cap': 'Low Cap',
  'micro-cap': 'Micro Cap',
  'stablecoin': 'Stablecoin',
  'defi': 'DeFi'
};

const CATEGORY_COLORS: Record<Category, string> = {
  'blue-chip': '#06b6d4',
  'mid-cap': '#7c3aed',
  'low-cap': '#22c55e',
  'micro-cap': '#f59e0b',
  'stablecoin': '#10b981',
  'defi': '#8b5cf6'
};

interface AllocationDonutChartProps {
  allocations: Record<Category, number>;
  onSliceClick?: (category: Category) => void;
  selectedCategory?: Category | 'all' | null;
}

const CustomTooltip = memo(({ active, payload, total }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const percent = ((data.value / total) * 100).toFixed(1);
    return (
      <div className="glass-panel border-divide-lighter/50 rounded-lg p-3 shadow-minimal-lg backdrop-blur-xl">
        <p className="font-semibold text-sm">{data.name}</p>
        <p className="text-xs text-muted-foreground">
          ${data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
        <p className="text-xs font-medium">{percent}%</p>
      </div>
    );
  }
  return null;
});

CustomTooltip.displayName = 'CustomTooltip';

export const AllocationDonutChart = memo(function AllocationDonutChart({ 
  allocations, 
  onSliceClick, 
  selectedCategory 
}: AllocationDonutChartProps) {
  const { data, total } = useMemo(() => {
    console.log('[DonutChart] allocations input:', allocations);
    const chartData = Object.entries(allocations)
      .filter(([_, value]) => value > 0)
      .map(([category, value]) => ({
        name: CATEGORY_LABELS[category as Category],
        category: category as Category,
        value,
        color: CATEGORY_COLORS[category as Category]
      }));

    const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);
    console.log('[DonutChart] chartData:', chartData, 'total:', totalValue);

    return { data: chartData, total: totalValue };
  }, [allocations]);

  return (
    <div className="space-y-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((entry, index) => (
                <linearGradient key={`gradient-${index}`} id={`gradient-${entry.category}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.9} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              onClick={(entry) => onSliceClick?.(entry.category)}
              style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
              animationDuration={300}
              animationEasing="ease-out"
              isAnimationActive={true}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={`url(#gradient-${entry.category})`}
                  opacity={selectedCategory && selectedCategory !== 'all' && selectedCategory !== entry.category ? 0.3 : 1}
                  stroke={selectedCategory && selectedCategory !== 'all' && selectedCategory === entry.category ? '#e5e7eb' : 'transparent'}
                  strokeWidth={selectedCategory && selectedCategory !== 'all' && selectedCategory === entry.category ? 2 : 0}
                  style={{ 
                    transition: 'opacity 150ms ease-out, stroke 150ms ease-out',
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.map((item, index) => (
          <div 
            key={index} 
            className={`flex items-center justify-between p-2 rounded-lg ${
              onSliceClick ? 'cursor-pointer hover:bg-secondary/8' : ''
            } ${selectedCategory && selectedCategory !== 'all' && selectedCategory === item.category ? 'bg-secondary/12 ring-1 ring-primary/20' : ''}`}
            onClick={() => onSliceClick?.(item.category)}
            style={{ transition: 'background-color 150ms ease-out' }}
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ 
                  background: `linear-gradient(135deg, ${item.color} 0%, ${item.color}cc 100%)`,
                  boxShadow: `0 0 6px ${item.color}40`,
                  transition: 'box-shadow 150ms ease-out'
                }}
              />
              <span className="text-sm font-medium">{item.name}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold">
                ${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {((item.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
