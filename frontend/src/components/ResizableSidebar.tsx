import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { type Category, type Holding, type PortfolioSnapshot, type Transaction, store } from '@/lib/dataModel';

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

const PRESETS = {
  conservative: {
    name: 'Conservative',
    description: 'Lower risk, stable growth',
    targets: {
      'blue-chip': 60,
      'mid-cap': 25,
      'low-cap': 10,
      'micro-cap': 5
    }
  },
  balanced: {
    name: 'Balanced',
    description: 'Moderate risk and reward',
    targets: {
      'blue-chip': 40,
      'mid-cap': 35,
      'low-cap': 20,
      'micro-cap': 5
    }
  },
  aggressive: {
    name: 'Aggressive',
    description: 'Higher risk, growth focused',
    targets: {
      'blue-chip': 20,
      'mid-cap': 30,
      'low-cap': 35,
      'micro-cap': 15
    }
  }
};

interface ResizableSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocations: Record<Category, number>;
  selectedPreset: keyof typeof PRESETS | null;
  onPresetChange: (preset: keyof typeof PRESETS | null) => void;
  onSliceClick: (category: Category) => void;
  selectedCategory: Category | null;
  holdings: Holding[];
  prices: Record<string, number>;
  snapshots: PortfolioSnapshot[];
  transactions: Transaction[];
}

export function ResizableSidebar({
  open,
  onOpenChange,
  allocations,
  selectedPreset,
  onPresetChange,
  onSliceClick,
  selectedCategory,
  holdings,
  prices,
  snapshots,
  transactions
}: ResizableSidebarProps) {
  const data = Object.entries(allocations)
    .filter(([_, value]) => value > 0)
    .map(([category, value]) => ({
      name: CATEGORY_LABELS[category as Category],
      category: category as Category,
      value,
      color: CATEGORY_COLORS[category as Category]
    }));

  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Calculate unrealized P&L
  const unrealizedPnL = holdings.reduce((sum, h) => {
    if (!h.avgCost) return sum;
    const price = prices[h.symbol];
    if (!price) return sum;
    const currentValue = h.tokensOwned * price;
    const initialCost = h.tokensOwned * h.avgCost;
    return sum + (currentValue - initialCost);
  }, 0);

  // Calculate realized P&L from transactions
  const realizedPnL = transactions
    .filter(tx => tx.type === 'sell' && tx.priceUsd)
    .reduce((sum, tx) => {
      const holding = holdings.find(h => h.symbol === tx.symbol);
      if (!holding?.avgCost || !tx.priceUsd) return sum;
      const profit = (tx.priceUsd - holding.avgCost) * tx.tokens;
      return sum + profit;
    }, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percent = ((data.value / total) * 100).toFixed(1);
      return (
        <div className="rounded-card bg-card border border-border/50 p-3 shadow-glow">
          <p className="font-semibold font-heading text-sm">{data.name}</p>
          <p className="text-xs text-muted-foreground">
            ${data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs font-medium">{percent}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-card border-border/50">
        <SheetHeader>
          <SheetTitle className="font-heading">Portfolio Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Full Allocation Donut */}
          <Card className="border-border/50 shadow-minimal">
            <CardContent className="pt-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      onClick={(entry) => onSliceClick(entry.category)}
                      style={{ cursor: 'pointer' }}
                    >
                      {data.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          opacity={selectedCategory && selectedCategory !== entry.category ? 0.3 : 1}
                          stroke={selectedCategory === entry.category ? '#e5e7eb' : 'none'}
                          strokeWidth={selectedCategory === entry.category ? 2 : 0}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {data.map((item, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-2 rounded-lg transition-smooth cursor-pointer hover:bg-secondary/30 ${
                      selectedCategory === item.category ? 'bg-secondary/50 focus-glow' : ''
                    }`}
                    onClick={() => onSliceClick(item.category)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold font-heading">
                        ${item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {((item.value / total) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Portfolio Presets */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold font-heading">Allocation Presets</h3>
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map(presetKey => {
              const preset = PRESETS[presetKey];
              const isSelected = selectedPreset === presetKey;

              return (
                <Card 
                  key={presetKey}
                  className={`cursor-pointer transition-smooth border-border/50 ${isSelected ? 'focus-glow' : 'hover:bg-secondary/20'}`}
                  onClick={() => onPresetChange(isSelected ? null : presetKey)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold font-heading text-sm">{preset.name}</h4>
                        <p className="text-xs text-muted-foreground">{preset.description}</p>
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="text-xs compact-padding gradient-accent">Active</Badge>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {Object.entries(preset.targets).map(([cat, target]) => (
                        <div key={cat} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{CATEGORY_LABELS[cat as Category]}</span>
                          <span className="font-medium">{target}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Mini P&L with Tabs */}
          <Card className="border-border/50 shadow-minimal">
            <CardContent className="p-3">
              <Tabs defaultValue="unrealized">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="unrealized" className="transition-smooth">Unrealized</TabsTrigger>
                  <TabsTrigger value="realized" className="transition-smooth">Realized</TabsTrigger>
                </TabsList>
                <TabsContent value="unrealized" className="mt-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground font-medium">Unrealized P&L</p>
                    <p className={`text-2xl font-bold font-heading ${unrealizedPnL >= 0 ? 'text-neon-success' : 'text-neon-danger'}`}>
                      {unrealizedPnL >= 0 ? '+' : ''}${Math.abs(unrealizedPnL).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </TabsContent>
                <TabsContent value="realized" className="mt-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground font-medium">Realized P&L</p>
                    <p className={`text-2xl font-bold font-heading ${realizedPnL >= 0 ? 'text-neon-success' : 'text-neon-danger'}`}>
                      {realizedPnL >= 0 ? '+' : ''}${Math.abs(realizedPnL).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Definitions Panel */}
          <Card className="border-border/50 shadow-minimal">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold font-heading">Category Definitions</h3>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <p className="font-medium">Blue Chip</p>
                  <p className="text-muted-foreground">Market cap ≥ ${(store.settings.thresholds.blueChipMin / 1e9).toFixed(0)}B</p>
                </div>
                <Separator className="bg-border/30" />
                <div>
                  <p className="font-medium">Mid Cap</p>
                  <p className="text-muted-foreground">
                    ${(store.settings.thresholds.midCapMin / 1e6).toFixed(0)}M - ${(store.settings.thresholds.blueChipMin / 1e9).toFixed(0)}B
                  </p>
                </div>
                <Separator className="bg-border/30" />
                <div>
                  <p className="font-medium">Low Cap</p>
                  <p className="text-muted-foreground">
                    ${(store.settings.thresholds.lowCapMin / 1e6).toFixed(0)}M - ${(store.settings.thresholds.midCapMin / 1e6).toFixed(0)}M
                  </p>
                </div>
                <Separator className="bg-border/30" />
                <div>
                  <p className="font-medium">Micro Cap</p>
                  <p className="text-muted-foreground">Market cap &lt; ${(store.settings.thresholds.lowCapMin / 1e6).toFixed(0)}M</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

