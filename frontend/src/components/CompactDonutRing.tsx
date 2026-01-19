import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { type Category } from '@/lib/dataModel';

const CATEGORY_COLORS: Record<Category, string> = {
  'blue-chip': 'oklch(0.646 0.222 41.116)',
  'mid-cap': 'oklch(0.6 0.118 184.704)',
  'low-cap': 'oklch(0.398 0.07 227.392)',
  'micro-cap': 'oklch(0.828 0.189 84.429)',
  'stablecoin': 'oklch(0.769 0.188 70.08)',
  'defi': 'oklch(0.55 0.18 264)'
};

interface CompactDonutRingProps {
  allocations: Record<Category, number>;
  onClick: () => void;
}

export function CompactDonutRing({ allocations, onClick }: CompactDonutRingProps) {
  const data = Object.entries(allocations)
    .filter(([_, value]) => value > 0)
    .map(([category, value]) => ({
      category: category as Category,
      value,
      color: CATEGORY_COLORS[category as Category]
    }));

  return (
    <div 
      className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity" 
      onClick={onClick}
      role="button"
      aria-label="Open allocation details"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={10}
            outerRadius={16}
            paddingAngle={0}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
