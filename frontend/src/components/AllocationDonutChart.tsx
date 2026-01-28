import { memo, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { type Category } from '@/lib/dataModel';
import { 
  CATEGORY_COLORS, 
  CATEGORY_LABELS, 
  CATEGORY_ORDER,
  type ExtendedCategory 
} from '@/lib/categoryColors';

interface AllocationDonutChartProps {
  allocations: Record<Category, number>;
  onSliceClick?: (category: Category) => void;
  selectedCategory?: Category | 'all' | null;
  cashValue?: number;
  stablecoinsOnlyValue?: number;
}

interface ChartDataItem {
  name: string;
  category: ExtendedCategory;
  value: number;
  color: string;
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

// Custom active shape for hover effect - subtle "explode" animation
const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload
  } = props;

  // Subtle outward shift (5 pixels) for the hovered slice
  const EXPLODE_OFFSET = 5;
  
  // Calculate the midpoint angle to determine shift direction
  const midAngle = (startAngle + endAngle) / 2;
  const midAngleRad = (midAngle * Math.PI) / 180;
  
  // Calculate offset position
  const offsetX = cx + EXPLODE_OFFSET * Math.cos(-midAngleRad);
  const offsetY = cy + EXPLODE_OFFSET * Math.sin(-midAngleRad);

  return (
    <g>
      <Sector
        cx={offsetX}
        cy={offsetY}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 3}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
          transition: 'all 200ms ease-out'
        }}
      />
    </g>
  );
};

export const AllocationDonutChart = memo(function AllocationDonutChart({ 
  allocations, 
  onSliceClick, 
  selectedCategory,
  cashValue,
  stablecoinsOnlyValue
}: AllocationDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { data, total, legendData } = useMemo(() => {
    const chartData: ChartDataItem[] = [];
    const legendItems: ChartDataItem[] = [];
    
    for (const [category, value] of Object.entries(allocations)) {
      if (value <= 0) continue;
      
      // Special handling for stablecoin category - split into Cash and Stablecoins
      if (category === 'stablecoin') {
        if (typeof cashValue === 'number' && typeof stablecoinsOnlyValue === 'number') {
          if (cashValue > 0) {
            chartData.push({
              name: CATEGORY_LABELS['cash'],
              category: 'cash',
              value: cashValue,
              color: CATEGORY_COLORS['cash']
            });
            legendItems.push({
              name: CATEGORY_LABELS['cash'],
              category: 'cash',
              value: cashValue,
              color: CATEGORY_COLORS['cash']
            });
          }
          if (stablecoinsOnlyValue > 0) {
            chartData.push({
              name: CATEGORY_LABELS['stablecoin'],
              category: 'stablecoin',
              value: stablecoinsOnlyValue,
              color: CATEGORY_COLORS['stablecoin']
            });
            legendItems.push({
              name: CATEGORY_LABELS['stablecoin'],
              category: 'stablecoin',
              value: stablecoinsOnlyValue,
              color: CATEGORY_COLORS['stablecoin']
            });
          }
        } else {
          // Fallback: show combined as "Stablecoins"
          chartData.push({
            name: 'Stablecoins',
            category: 'stablecoin',
            value,
            color: CATEGORY_COLORS['stablecoin']
          });
          legendItems.push({
            name: 'Stablecoins',
            category: 'stablecoin',
            value,
            color: CATEGORY_COLORS['stablecoin']
          });
        }
      } else {
        const cat = category as Category;
        chartData.push({
          name: CATEGORY_LABELS[cat] || cat,
          category: cat,
          value,
          color: CATEGORY_COLORS[cat] || CATEGORY_COLORS['micro-cap']
        });
        legendItems.push({
          name: CATEGORY_LABELS[cat] || cat,
          category: cat,
          value,
          color: CATEGORY_COLORS[cat] || CATEGORY_COLORS['micro-cap']
        });
      }
    }

    const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

    // Sort legendItems according to CATEGORY_ORDER
    const sortedLegendItems = [...legendItems].sort((a, b) => {
      const indexA = CATEGORY_ORDER.indexOf(a.category);
      const indexB = CATEGORY_ORDER.indexOf(b.category);
      return indexA - indexB;
    });

    return { data: chartData, total: totalValue, legendData: sortedLegendItems };
  }, [allocations, cashValue, stablecoinsOnlyValue]);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  // Find the index in chartData that matches a legend item's category
  const getChartIndexForCategory = (category: ExtendedCategory): number => {
    return data.findIndex(d => d.category === category);
  };

  return (
    <div className="space-y-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((entry, index) => (
                <linearGradient 
                  key={`gradient-${index}`} 
                  id={`gradient-${entry.category}`} 
                  x1="0" y1="0" x2="1" y2="1"
                >
                  <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.85} />
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
              activeIndex={activeIndex !== null ? activeIndex : undefined}
              activeShape={renderActiveShape}
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              onClick={(entry) => {
                if (entry.category === 'cash') {
                  onSliceClick?.('stablecoin');
                } else {
                  onSliceClick?.(entry.category as Category);
                }
              }}
              style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
              animationDuration={300}
              animationEasing="ease-out"
              isAnimationActive={true}
            >
              {data.map((entry, index) => {
                const isSelected = selectedCategory && 
                  selectedCategory !== 'all' && 
                  (selectedCategory === entry.category || 
                   (entry.category === 'cash' && selectedCategory === 'stablecoin'));
                const isOther = selectedCategory && 
                  selectedCategory !== 'all' && 
                  !isSelected;
                
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#gradient-${entry.category})`}
                    opacity={isOther ? 0.3 : 1}
                    stroke={isSelected ? '#e5e7eb' : 'transparent'}
                    strokeWidth={isSelected ? 2 : 0}
                    style={{ 
                      transition: 'opacity 150ms ease-out, stroke 150ms ease-out',
                      filter: activeIndex === index ? 'none' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                    }}
                  />
                );
              })}
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {legendData.map((item, index) => {
          const chartIndex = getChartIndexForCategory(item.category);
          const isHovered = activeIndex === chartIndex;
          const isSelected = selectedCategory && 
            selectedCategory !== 'all' && 
            (selectedCategory === item.category || 
             (item.category === 'cash' && selectedCategory === 'stablecoin'));
          
          return (
            <div 
              key={index} 
              className={`flex items-center justify-between p-2 rounded-lg transition-all duration-150 ${
                onSliceClick ? 'cursor-pointer hover:bg-secondary/8' : ''
              } ${isSelected ? 'bg-secondary/12 ring-1 ring-primary/20' : ''} ${
                isHovered ? 'bg-secondary/10 scale-[1.01]' : ''
              }`}
              onClick={() => {
                if (item.category === 'cash') {
                  onSliceClick?.('stablecoin');
                } else {
                  onSliceClick?.(item.category as Category);
                }
              }}
              onMouseEnter={() => setActiveIndex(chartIndex)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-2">
                <div 
                  className={`w-3 h-3 rounded-full transition-all duration-150 ${
                    isHovered ? 'scale-125' : ''
                  }`}
                  style={{ 
                    background: `linear-gradient(135deg, ${item.color} 0%, ${item.color}cc 100%)`,
                    boxShadow: isHovered 
                      ? `0 0 10px ${item.color}60` 
                      : `0 0 6px ${item.color}40`,
                  }}
                />
                <span className="text-sm font-medium">{item.name}</span>
                {item.category === 'cash' && (
                  <span 
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider"
                    style={{
                      background: 'rgba(100, 116, 139, 0.15)',
                      color: '#94a3b8',
                      border: '1px solid rgba(100, 116, 139, 0.25)',
                    }}
                  >
                    Manual
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold">
                  ${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  {total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
