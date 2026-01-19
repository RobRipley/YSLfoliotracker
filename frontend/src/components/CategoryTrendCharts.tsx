import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type PortfolioSnapshot, type Category } from '@/lib/dataModel';

const CATEGORY_LABELS: Record<Category, string> = {
  'blue-chip': 'Blue Chip',
  'mid-cap': 'Mid Cap',
  'low-cap': 'Low Cap',
  'micro-cap': 'Micro Cap',
  'stablecoin': 'Stablecoin',
  'defi': 'DeFi'
};

const CATEGORY_COLORS: Record<Category, string> = {
  'blue-chip': 'oklch(0.646 0.222 41.116)',
  'mid-cap': 'oklch(0.6 0.118 184.704)',
  'low-cap': 'oklch(0.398 0.07 227.392)',
  'micro-cap': 'oklch(0.828 0.189 84.429)',
  'stablecoin': 'oklch(0.769 0.188 70.08)',
  'defi': 'oklch(0.55 0.18 264)'
};

interface CategoryTrendChartsProps {
  snapshots: PortfolioSnapshot[];
}

export function CategoryTrendCharts({ snapshots }: CategoryTrendChartsProps) {
  // Filter to last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSnapshots = snapshots.filter(s => s.timestamp >= thirtyDaysAgo);

  const categories: Array<{ key: keyof PortfolioSnapshot; category: Category }> = [
    { key: 'blueChipValue', category: 'blue-chip' },
    { key: 'midCapValue', category: 'mid-cap' },
    { key: 'lowCapValue', category: 'low-cap' },
  ];

  const CustomTooltip = ({ active, payload, category }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      return (
        <div className="glass-effect rounded-lg p-2 shadow-lg border">
          <p className="text-xs font-medium">{CATEGORY_LABELS[category]}</p>
          <p className="text-sm font-semibold">
            ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {categories.map(({ key, category }) => {
        const chartData = recentSnapshots.map(snapshot => ({
          timestamp: snapshot.timestamp,
          value: snapshot[key] as number,
        }));

        const currentValue = chartData[chartData.length - 1]?.value || 0;
        const previousValue = chartData[0]?.value || 0;
        const change = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;

        return (
          <Card key={category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: CATEGORY_COLORS[category] }}
                />
                {CATEGORY_LABELS[category]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <p className="text-2xl font-bold">
                    ${currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className={`text-sm font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}% (30d)
                  </p>
                </div>
                <div className="h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <Tooltip content={(props) => <CustomTooltip {...props} category={category} />} />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={CATEGORY_COLORS[category]}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
