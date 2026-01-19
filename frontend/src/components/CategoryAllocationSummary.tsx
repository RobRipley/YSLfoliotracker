import { memo, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { Category } from '@/lib/dataModel';

interface CategoryAllocationSummaryProps {
  totals: {
    totalValue: number;
    byCategory: Record<Category, number>;
  };
  selectedCategory: Category | 'all';
  onCategoryChange: (category: Category | 'all') => void;
}

const CATEGORY_LABELS: Record<Category, string> = {
  'blue-chip': 'Blue Chip',
  'mid-cap': 'Mid Cap',
  'low-cap': 'Low Cap',
  'micro-cap': 'Micro Cap',
  'stablecoin': 'Stablecoin',
  'defi': 'DeFi',
};

export const CategoryAllocationSummary = memo(function CategoryAllocationSummary({
  totals,
  selectedCategory,
  onCategoryChange,
}: CategoryAllocationSummaryProps) {
  const rows = useMemo(() => {
    const { totalValue, byCategory } = totals;

    const entries = Object.entries(byCategory) as Array<[Category, number]>;

    // Sort biggest allocations first for a nicer overview
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);

    return sorted.map(([category, value]) => {
      const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;

      return {
        category,
        label: CATEGORY_LABELS[category],
        value,
        percent,
      };
    });
  }, [totals]);

  if (!rows.length || totals.totalValue <= 0) {
    return null;
  }

  const handleCategoryClick = (category: Category) => {
    // Clicking the same category again resets to "all"
    if (selectedCategory === category) {
      onCategoryChange('all');
    } else {
      onCategoryChange(category);
    }
  };

  return (
    <Card className="glass-panel border-divide/80">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-tight text-foreground/70">
            Allocation by category
          </div>
          <button
            type="button"
            onClick={() => onCategoryChange('all')}
            className="text-[11px] text-primary/80 hover:text-primary transition-smooth"
          >
            Reset view
          </button>
        </div>

        <div className="space-y-1.5">
          {rows.map(({ category, label, value, percent }) => (
            <button
              key={category}
              type="button"
              onClick={() => handleCategoryClick(category)}
              className={[
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-smooth',
                selectedCategory === category
                  ? 'bg-primary/10 border border-primary/40 shadow-xs'
                  : 'hover:bg-secondary/60 border border-transparent',
              ].join(' ')}
            >
              <div className="flex-1 pr-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-foreground/90">{label}</div>
                  <div className="tabular-nums text-[11px] text-muted-foreground">
                    {percent.toFixed(1)}%
                  </div>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.max(2, percent)}%` }}
                  />
                </div>
              </div>
              <div className="text-right text-[11px] tabular-nums text-muted-foreground">
                ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});