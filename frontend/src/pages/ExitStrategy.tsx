import { useState, useEffect, useMemo, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { store, getCategoryForHolding, type Holding, type Category } from '@/lib/dataModel';
import { getPriceAggregator, type ExtendedPriceQuote } from '@/lib/priceService';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { formatPrice, formatTokens } from '@/lib/formatting';

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

type PresetType = 'conservative' | 'aggressive' | 'custom';

interface ExitPlan {
  holdingId: string;
  useBase: boolean;
  preset: PresetType;
  rungs: Array<{
    percent: number;
    multiplier: number;
    targetPrice: number;
    tokensToSell: number;
  }>;
}

// Blue Chip Conservative (unchanged)
const BLUE_CHIP_CONSERVATIVE = [
  { percent: 10, multiplier: 1.2 },
  { percent: 20, multiplier: 1.4 },
  { percent: 25, multiplier: 1.8 },
  { percent: 40, multiplier: 2.0 },
  { percent: 5, multiplier: 0 },  // Remaining
];

// Mid Cap Aggressive
const MID_CAP_AGGRESSIVE = [
  { percent: 10, multiplier: 2 },
  { percent: 20, multiplier: 3 },
  { percent: 25, multiplier: 5 },
  { percent: 40, multiplier: 10 },
  { percent: 5, multiplier: 0 },  // Remaining
];

// Mid Cap Conservative
const MID_CAP_CONSERVATIVE = [
  { percent: 40, multiplier: 2 },
  { percent: 25, multiplier: 3 },
  { percent: 20, multiplier: 5 },
  { percent: 10, multiplier: 10 },
  { percent: 5, multiplier: 0 },  // Remaining
];

// Low Cap Aggressive
const LOW_CAP_AGGRESSIVE = [
  { percent: 10, multiplier: 2 },
  { percent: 20, multiplier: 3 },
  { percent: 25, multiplier: 5 },
  { percent: 40, multiplier: 10 },
  { percent: 5, multiplier: 0 },  // Remaining
];

// Low Cap Conservative
const LOW_CAP_CONSERVATIVE = [
  { percent: 40, multiplier: 2 },
  { percent: 25, multiplier: 3 },
  { percent: 20, multiplier: 5 },
  { percent: 10, multiplier: 10 },
  { percent: 5, multiplier: 0 },  // Remaining
];

interface AssetRowProps {
  holding: Holding;
  price: ExtendedPriceQuote | undefined;
  category: Category;
  plan: ExitPlan | undefined;
  onPresetConservative: () => void;
  onPresetAggressive: () => void;
  onPresetCustom: () => void;
  onUpdateRung: (rungIndex: number, field: 'percent' | 'multiplier', value: number) => void;
  onToggleBase: (useBase: boolean) => void;
}

const AssetRow = memo(({ 
  holding, 
  price, 
  category, 
  plan, 
  onPresetConservative,
  onPresetAggressive,
  onPresetCustom,
  onUpdateRung,
  onToggleBase
}: AssetRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate values before any early returns
  const avgCost = holding.avgCost || 0;
  const base = plan?.useBase ? avgCost * 1.1 : avgCost;
  const totalValue = price ? holding.tokensOwned * price.priceUsd : 0;
  const totalCost = holding.tokensOwned * avgCost;

  // Calculate expected profit and proceeds
  const { expectedProfit, totalProceeds } = useMemo(() => {
    if (!plan) return { expectedProfit: 0, totalProceeds: 0 };
    let totalRevenue = 0;
    plan.rungs.forEach(rung => {
      if (rung.multiplier > 0) {
        totalRevenue += rung.tokensToSell * rung.targetPrice;
      }
    });
    return {
      expectedProfit: totalRevenue - totalCost,
      totalProceeds: totalRevenue
    };
  }, [plan, totalCost]);

  const percentGain = totalCost > 0 ? (expectedProfit / totalCost) * 100 : 0;

  // Early return after all hooks
  if (!holding.avgCost || !plan) return null;

  // Determine if editing is locked (locked for conservative and aggressive presets)
  const isLocked = plan.preset !== 'custom';

  return (
    <div className="border-b border-divide-lighter/10 last:border-0">
      {/* Collapsed Summary Row */}
      <div className="p-4 hover:bg-secondary/4 transition-colors duration-150">
        <div className="flex items-center justify-between gap-4">
          {/* Left Section: Expand Button + Asset Info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-secondary/10 rounded transition-colors duration-150"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            <div className="flex items-center gap-6 flex-1 min-w-0">
              <div className="font-semibold font-heading text-base min-w-[60px]">
                {holding.symbol}
              </div>
              <div className="text-sm text-muted-foreground min-w-[100px]">
                {formatTokens(holding.tokensOwned)} tokens
              </div>
              <div className="text-sm text-muted-foreground min-w-[80px]">
                Avg: {formatPrice(avgCost)}
              </div>
              <div className="text-sm text-muted-foreground min-w-[80px]">
                Base: {formatPrice(base)}
              </div>
              <div className="font-semibold min-w-[100px]">
                {formatPrice(totalValue)}
              </div>
            </div>
          </div>

          {/* Right Section: Expected Profit, % Gain, Base Checkbox, Preset Buttons */}
          <div className="flex items-center gap-4">
            <div className="text-right min-w-[120px]">
              <div className={`font-semibold ${expectedProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatPrice(expectedProfit)}
              </div>
              <div className="text-xs text-muted-foreground">Expected Profit</div>
            </div>

            <div className="text-right min-w-[80px]">
              <div className={`font-semibold ${percentGain >= 0 ? 'text-success' : 'text-danger'}`}>
                {percentGain >= 0 ? '+' : ''}{percentGain.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">% Gain</div>
            </div>

            <div className="flex items-center gap-2 min-w-[80px]">
              <Checkbox
                id={`base-${holding.id}`}
                checked={plan.useBase}
                onCheckedChange={(checked) => onToggleBase(checked === true)}
              />
              <label
                htmlFor={`base-${holding.id}`}
                className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1"
              >
                Base
                <div className="group relative">
                  <Info className="w-3 h-3 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-secondary/95 backdrop-blur-sm border border-divide-lighter/30 rounded-lg text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10 shadow-lg">
                    When enabled, calculates exit points from 10% above average purchase price.
                  </div>
                </div>
              </label>
            </div>

            <button
              onClick={onPresetConservative}
              className={`gradient-outline-btn text-xs px-3 py-1.5 whitespace-nowrap transition-all duration-150 ${
                plan.preset === 'conservative' 
                  ? 'ring-2 ring-[#06b6d4]/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]' 
                  : ''
              }`}
            >
              <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                Conservative
              </span>
            </button>

            {category !== 'blue-chip' && (
              <button
                onClick={onPresetAggressive}
                className={`gradient-outline-btn text-xs px-3 py-1.5 whitespace-nowrap transition-all duration-150 ${
                  plan.preset === 'aggressive' 
                    ? 'ring-2 ring-[#06b6d4]/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]' 
                    : ''
                }`}
              >
                <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                  Aggressive
                </span>
              </button>
            )}

            <button
              onClick={onPresetCustom}
              className={`gradient-outline-btn text-xs px-3 py-1.5 whitespace-nowrap transition-all duration-150 ${
                plan.preset === 'custom' 
                  ? 'ring-2 ring-[#7c3aed]/40 shadow-[0_0_12px_rgba(124,58,237,0.3)]' 
                  : ''
              }`}
            >
              <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                Custom
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Exit Ladder Table */}
      {isExpanded && (
        <div 
          className="px-4 pb-4 overflow-hidden"
          style={{
            animation: 'expandRow 180ms ease-out'
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divide-lighter/15">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Exit Point</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Percent</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Multiplier</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Tokens to Sell</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Target Price</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Proceeds</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Profit from Sale</th>
                </tr>
              </thead>
              <tbody>
                {plan.rungs.map((rung, idx) => {
                  const proceeds = rung.tokensToSell * rung.targetPrice;
                  const profitFromSale = proceeds - (rung.tokensToSell * avgCost);
                  const isRemaining = idx === plan.rungs.length - 1;
                  
                  return (
                    <tr key={idx} className="border-b border-divide-lighter/8 last:border-0 hover:bg-secondary/4 transition-colors duration-150">
                      <td className="py-2 px-3">
                        {isRemaining ? 'Remaining' : `Exit ${idx + 1}`}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {isRemaining ? (
                          <div className="text-muted-foreground">{rung.percent.toFixed(1)}%</div>
                        ) : (
                          <Input
                            type="number"
                            value={rung.percent}
                            onChange={(e) => onUpdateRung(idx, 'percent', parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 text-right text-sm ml-auto"
                            min="0"
                            max="100"
                            disabled={isLocked}
                          />
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Input
                          type="number"
                          value={rung.multiplier}
                          onChange={(e) => onUpdateRung(idx, 'multiplier', parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-right text-sm ml-auto"
                          min="0"
                          step="0.1"
                          disabled={isLocked}
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        {formatTokens(rung.tokensToSell)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">
                        {rung.multiplier === 0 ? '—' : formatPrice(rung.targetPrice)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">
                        {rung.multiplier === 0 ? '—' : formatPrice(proceeds)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {rung.multiplier === 0 ? (
                          '—'
                        ) : (
                          <span className={profitFromSale >= 0 ? 'text-success' : 'text-danger'}>
                            {formatPrice(profitFromSale)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

AssetRow.displayName = 'AssetRow';

export function ExitStrategy() {
  const [prices, setPrices] = useState<Record<string, ExtendedPriceQuote>>({});
  const [exitPlans, setExitPlans] = useState<Record<string, ExitPlan>>({});

  // Fetch prices
  useEffect(() => {
    const aggregator = getPriceAggregator();
    
    const fetchPrices = async () => {
      const symbols = store.holdings.map(h => h.symbol);
      if (symbols.length === 0) return;

      try {
        const quotes = await aggregator.getPrice(symbols);
        const priceMap: Record<string, ExtendedPriceQuote> = {};
        quotes.forEach(q => {
          priceMap[q.symbol] = q;
        });
        setPrices(priceMap);
      } catch (error) {
        console.error('Failed to fetch prices:', error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);

    return () => clearInterval(interval);
  }, []);

  // Initialize exit plans for all holdings with proper defaults
  useEffect(() => {
    const plans: Record<string, ExitPlan> = {};
    
    store.holdings.forEach(holding => {
      if (!holding.avgCost) return;
      
      const price = prices[holding.symbol];
      if (!price?.marketCapUsd) return;
      
      const category = getCategoryForHolding(holding, price.marketCapUsd);
      const useBase = true; // Default to using base
      const avgCost = holding.avgCost;
      const base = useBase ? avgCost * 1.1 : avgCost;
      
      // Select proper template based on category - Mid and Low cap default to Aggressive
      let template = category === 'blue-chip' ? BLUE_CHIP_CONSERVATIVE : 
                     category === 'mid-cap' ? MID_CAP_AGGRESSIVE : LOW_CAP_AGGRESSIVE;
      
      // Default preset based on category
      const defaultPreset: PresetType = category === 'blue-chip' ? 'conservative' : 'aggressive';
      
      const rungs = template.map((t, idx) => {
        const isRemaining = idx === template.length - 1;
        return {
          percent: t.percent,
          multiplier: t.multiplier,
          targetPrice: isRemaining || t.multiplier === 0 ? 0 : base * t.multiplier,
          tokensToSell: (holding.tokensOwned * t.percent) / 100
        };
      });
      
      plans[holding.id] = {
        holdingId: holding.id,
        useBase,
        preset: defaultPreset,
        rungs
      };
    });
    
    setExitPlans(plans);
  }, [prices, store.holdings.length]);

  // Broadcast exit plan updates to Portfolio page
  useEffect(() => {
    const event = new CustomEvent('exitPlansUpdated', { detail: exitPlans });
    window.dispatchEvent(event);
  }, [exitPlans]);

  const handlePresetConservative = (holdingId: string, category: Category) => {
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const avgCost = holding.avgCost;
    const currentPlan = exitPlans[holdingId];
    const useBase = currentPlan?.useBase ?? true;
    const base = useBase ? avgCost * 1.1 : avgCost;
    const template = category === 'blue-chip' ? BLUE_CHIP_CONSERVATIVE : 
                     category === 'mid-cap' ? MID_CAP_CONSERVATIVE : LOW_CAP_CONSERVATIVE;
    
    const rungs = template.map((t, idx) => {
      const isRemaining = idx === template.length - 1;
      return {
        percent: t.percent,
        multiplier: t.multiplier,
        targetPrice: isRemaining || t.multiplier === 0 ? 0 : base * t.multiplier,
        tokensToSell: (holding.tokensOwned * t.percent) / 100
      };
    });
    
    setExitPlans(prev => ({
      ...prev,
      [holdingId]: { holdingId, useBase, preset: 'conservative', rungs }
    }));
    
    toast.success('Applied Conservative preset');
  };

  const handlePresetAggressive = (holdingId: string, category: Category) => {
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const avgCost = holding.avgCost;
    const currentPlan = exitPlans[holdingId];
    const useBase = currentPlan?.useBase ?? true;
    const base = useBase ? avgCost * 1.1 : avgCost;
    const template = category === 'mid-cap' ? MID_CAP_AGGRESSIVE : LOW_CAP_AGGRESSIVE;
    
    const rungs = template.map((t, idx) => {
      const isRemaining = idx === template.length - 1;
      return {
        percent: t.percent,
        multiplier: t.multiplier,
        targetPrice: isRemaining || t.multiplier === 0 ? 0 : base * t.multiplier,
        tokensToSell: (holding.tokensOwned * t.percent) / 100
      };
    });
    
    setExitPlans(prev => ({
      ...prev,
      [holdingId]: { holdingId, useBase, preset: 'aggressive', rungs }
    }));
    
    toast.success('Applied Aggressive preset');
  };

  const handlePresetCustom = (holdingId: string) => {
    setExitPlans(prev => {
      const plan = prev[holdingId];
      if (!plan) return prev;
      
      return {
        ...prev,
        [holdingId]: { ...plan, preset: 'custom' }
      };
    });
    
    toast.success('Custom mode enabled - you can now edit percentages and multipliers');
  };

  const handleUpdateRung = (holdingId: string, rungIndex: number, field: 'percent' | 'multiplier', value: number) => {
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const avgCost = holding.avgCost;
    
    setExitPlans(prev => {
      const plan = prev[holdingId];
      if (!plan) return prev;
      
      const base = plan.useBase ? avgCost * 1.1 : avgCost;
      const newRungs = [...plan.rungs];
      
      if (field === 'multiplier') {
        // Update multiplier and recalculate target price and proceeds
        newRungs[rungIndex] = {
          ...newRungs[rungIndex],
          multiplier: value,
          targetPrice: value > 0 ? base * value : 0
        };
      } else {
        // When updating percent, recalculate remaining percentage
        newRungs[rungIndex] = {
          ...newRungs[rungIndex],
          percent: value,
          tokensToSell: (holding.tokensOwned * value) / 100
        };
        
        // Calculate remaining percentage (last rung)
        const sumOfExits = newRungs.slice(0, -1).reduce((sum, rung) => sum + rung.percent, 0);
        const remainingPercent = Math.max(0, 100 - sumOfExits);
        newRungs[newRungs.length - 1] = {
          ...newRungs[newRungs.length - 1],
          percent: remainingPercent,
          tokensToSell: (holding.tokensOwned * remainingPercent) / 100
        };
      }
      
      return {
        ...prev,
        [holdingId]: { ...plan, rungs: newRungs }
      };
    });
  };

  const handleToggleBase = (holdingId: string, useBase: boolean) => {
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const avgCost = holding.avgCost;
    
    setExitPlans(prev => {
      const plan = prev[holdingId];
      if (!plan) return prev;
      
      const base = useBase ? avgCost * 1.1 : avgCost;
      
      // Recalculate all target prices with new base (except remaining)
      const newRungs = plan.rungs.map((rung, idx) => {
        const isRemaining = idx === plan.rungs.length - 1;
        return {
          ...rung,
          targetPrice: isRemaining || rung.multiplier === 0 ? 0 : base * rung.multiplier
        };
      });
      
      return {
        ...prev,
        [holdingId]: { ...plan, useBase, rungs: newRungs }
      };
    });
  };

  const groupedHoldings = useMemo(() => {
    const groups: Record<Category, Holding[]> = {
      'blue-chip': [],
      'mid-cap': [],
      'low-cap': [],
      'micro-cap': [],
      'stablecoin': [],
      'defi': []
    };

    store.holdings.forEach(holding => {
      const price = prices[holding.symbol];
      if (price?.marketCapUsd) {
        const category = getCategoryForHolding(holding, price.marketCapUsd);
        groups[category].push(holding);
      }
    });

    return groups;
  }, [prices, store.holdings.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Exit Strategy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan your exit ladder for each asset with customizable targets
          </p>
        </div>
      </div>

      {/* Holdings by Category */}
      <div className="space-y-6">
        {(['blue-chip', 'mid-cap', 'low-cap'] as Category[]).map(category => {
          const holdings = groupedHoldings[category];
          if (holdings.length === 0) return null;

          return (
            <Card key={category} className="overflow-hidden border-divide-lighter/30 glass-panel shadow-minimal">
              <div className="p-4 border-b border-divide-lighter/20 flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ 
                    backgroundColor: CATEGORY_COLORS[category],
                    boxShadow: `0 0 8px ${CATEGORY_COLORS[category]}60`
                  }}
                />
                <h2 className="text-lg font-semibold font-heading">{CATEGORY_LABELS[category]}</h2>
                <Badge variant="secondary" className="text-xs">{holdings.length}</Badge>
              </div>

              <div className="overflow-x-auto">
                {holdings.map(holding => {
                  const price = prices[holding.symbol];
                  const plan = exitPlans[holding.id];

                  return (
                    <AssetRow
                      key={holding.id}
                      holding={holding}
                      price={price}
                      category={category}
                      plan={plan}
                      onPresetConservative={() => handlePresetConservative(holding.id, category)}
                      onPresetAggressive={() => handlePresetAggressive(holding.id, category)}
                      onPresetCustom={() => handlePresetCustom(holding.id)}
                      onUpdateRung={(rungIndex, field, value) => handleUpdateRung(holding.id, rungIndex, field, value)}
                      onToggleBase={(useBase) => handleToggleBase(holding.id, useBase)}
                    />
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {store.holdings.length === 0 && (
        <Card className="p-12 text-center glass-panel border-divide-lighter/30">
          <p className="text-muted-foreground">No holdings found. Add assets to your portfolio first.</p>
        </Card>
      )}
    </div>
  );
}
