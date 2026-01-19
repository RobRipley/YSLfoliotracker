import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingDown, X } from 'lucide-react';

interface QuickActionBarProps {
  onAddAsset: () => void;
  onLogSale: () => void;
  activeFilters?: Array<{ label: string; onRemove: () => void }>;
}

export function QuickActionBar({ onAddAsset, onLogSale, activeFilters = [] }: QuickActionBarProps) {
  return (
    <div className="glass-panel rounded-lg p-3 shadow-minimal border border-border/50 transition-smooth">
      <div className="flex items-center justify-between gap-4">
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onAddAsset}
            size="sm"
            className="gradient-outline-btn transition-smooth"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
              Add Asset
            </span>
          </Button>
          <Button
            onClick={onLogSale}
            size="sm"
            variant="outline"
            className="gradient-outline-btn transition-smooth"
          >
            <TrendingDown className="h-4 w-4 mr-2" />
            <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
              Log Sale
            </span>
          </Button>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filters:</span>
            {activeFilters.map((filter, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1 cursor-pointer hover:bg-destructive/20 transition-smooth"
                onClick={filter.onRemove}
              >
                {filter.label}
                <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
