import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { store, getCategoryForHolding, type Holding, type Category } from '@/lib/dataModel';
import { getPriceAggregator, type ExtendedPriceQuote } from '@/lib/priceService';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Info, Loader2 } from 'lucide-react';
import { formatPrice } from '@/lib/formatting';

const EXIT_PLANS_STORAGE_KEY = 'ysl-exit-plans';

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

// Blue Chip Conservative
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

// Helper functions for localStorage persistence
function loadExitPlans(): Record<string, ExitPlan> {
  try {
    const stored = localStorage.getItem(EXIT_PLANS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[ExitStrategy] Failed to load exit plans from localStorage:', e);
  }
  return {};
}

function saveExitPlans(plans: Record<string, ExitPlan>): void {
  try {
    localStorage.setItem(EXIT_PLANS_STORAGE_KEY, JSON.stringify(plans));
  } catch (e) {
    console.warn('[ExitStrategy] Failed to save exit plans to localStorage:', e);
  }
}

/**
 * Format tokens with smart decimal display
 * - Only shows as many decimals as needed
 * - Trims trailing zeros after decimal
 * - Shows no decimal point if all decimals are zero
 * - Respects maximum precision setting for assets that truly need 8 decimals
 */
function formatTokensSmart(value: number, maxPrecision: number = 8): string {
  if (value === 0) return '0';
  if (isNaN(value) || !isFinite(value)) return '0';
  
  // For very small numbers, use more precision
  const absValue = Math.abs(value);
  let precision = maxPrecision;
  
  if (absValue >= 10000) {
    precision = 0;  // No decimals for large numbers
  } else if (absValue >= 1000) {
    precision = 1;
  } else if (absValue >= 100) {
    precision = 2;
  } else if (absValue >= 1) {
    precision = 4;
  } else if (absValue >= 0.0001) {
    precision = 6;
  }
  
  // Format with precision
  const formatted = value.toFixed(precision);
  
  // Remove trailing zeros after decimal point and unnecessary decimal point
  if (formatted.includes('.')) {
    const trimmed = formatted.replace(/\.?0+$/, '');
    return trimmed === '' ? '0' : trimmed;
  }
  
  return formatted;
}

// Create default exit plan for a holding
function createDefaultExitPlan(
  holding: Holding,
  category: Category
): ExitPlan | null {
  if (!holding.avgCost) return null;
  
  const useBase = true;
  const avgCost = holding.avgCost;
  const base = useBase ? avgCost * 1.1 : avgCost;
  
  // Select proper template based on category
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
  
  return {
    holdingId: holding.id,
    useBase,
    preset: defaultPreset,
    rungs
  };
}

interface AssetRowProps {
  holding: Holding;
  price: ExtendedPriceQuote | undefined;
  category: Category;
  plan: ExitPlan | undefined;
  onPresetChange: (preset: PresetType) => void;
  onUpdateRung: (rungIndex: number, field: 'percent' | 'multiplier', value: number) => void;
  onToggleBase: (useBase: boolean) => void;
}

const AssetRow = memo(({ 
  holding, 
  price, 
  category, 
  plan, 
  onPresetChange,
  onUpdateRung,
  onToggleBase
}: AssetRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate values - guard against undefined/NaN
  const avgCost = holding.avgCost || 0;
  const planBasis = plan?.useBase ? avgCost * 1.1 : avgCost;
  const currentPrice = price?.priceUsd ?? 0;
  
  // Position Value = current value (tokens * current price) - PRIMARY
  const positionValue = holding.tokensOwned * currentPrice;
  
  // Total Cost = cost basis (tokens * avg cost) - SECONDARY
  const totalCost = holding.tokensOwned * avgCost;
  
  // Unrealized PnL = Value - Cost
  const unrealizedPnL = positionValue - totalCost;
  
  // Unrealized Return % = PnL / Cost
  const unrealizedReturn = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0;

  // Calculate expected profit and proceeds - with NaN guards
  const { expectedProfit, totalProceeds } = useMemo(() => {
    if (!plan || !plan.rungs) return { expectedProfit: 0, totalProceeds: 0 };
    
    let totalRevenue = 0;
    plan.rungs.forEach(rung => {
      const tokens = rung.tokensToSell ?? 0;
      const targetPrice = rung.targetPrice ?? 0;
      const multiplier = rung.multiplier ?? 0;
      
      if (multiplier > 0 && !isNaN(tokens) && !isNaN(targetPrice)) {
        totalRevenue += tokens * targetPrice;
      }
    });
    
    const profit = isNaN(totalRevenue) || isNaN(totalCost) ? 0 : totalRevenue - totalCost;
    
    return {
      expectedProfit: profit,
      totalProceeds: totalRevenue
    };
  }, [plan, totalCost]);

  const percentGain = totalCost > 0 && !isNaN(expectedProfit) ? (expectedProfit / totalCost) * 100 : 0;

  // Early return after all hooks - show nothing if no avgCost or no plan
  if (!holding.avgCost || !plan) return null;

  // Determine if editing is locked (locked for conservative and aggressive presets)
  const isLocked = plan.preset !== 'custom';
  
  // Get available strategies based on category
  const strategyOptions = category === 'blue-chip' 
    ? [{ value: 'conservative', label: 'Conservative' }, { value: 'custom', label: 'Custom' }]
    : [{ value: 'conservative', label: 'Conservative' }, { value: 'aggressive', label: 'Aggressive' }, { value: 'custom', label: 'Custom' }];

  return (
    <div className="border-b border-divide-lighter/10 last:border-0">
      {/* Collapsed Summary Row */}
      <div className="px-4 py-3 hover:bg-secondary/4 transition-colors duration-150">
        <div className="flex items-center gap-6">
          {/* Left Section: Expand Button + Asset Info */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-secondary/10 rounded-md transition-colors duration-150"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {/* Symbol - prominent */}
            <div className="font-semibold font-heading text-base w-16">
              {holding.symbol}
            </div>
            
            {/* Tokens */}
            <div className="text-sm text-muted-foreground/80 w-28">
              {formatTokensSmart(holding.tokensOwned)} tokens
            </div>
          </div>

          {/* Position Value (PRIMARY) + Total Cost (SECONDARY) */}
          <div className="flex items-center gap-6 flex-shrink-0">
            {/* Position Value - visually primary */}
            <div className="text-left w-28">
              <div className="font-semibold text-foreground">{formatPrice(positionValue)}</div>
              <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Position Value</div>
            </div>
            
            {/* Total Cost - visually secondary */}
            <div className="text-left w-24">
              <div className="text-sm text-foreground/70">{formatPrice(totalCost)}</div>
              <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Total Cost</div>
            </div>
            
            {/* Unrealized PnL & Return */}
            <div className="text-left w-28">
              <div className={`text-sm font-medium ${unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                {unrealizedPnL >= 0 ? '+' : ''}{formatPrice(unrealizedPnL)}
              </div>
              <div className={`text-[10px] ${unrealizedReturn >= 0 ? 'text-success/70' : 'text-danger/70'}`}>
                {unrealizedReturn >= 0 ? '+' : ''}{unrealizedReturn.toFixed(1)}% unrealized
              </div>
            </div>
          </div>

          {/* Plan Basis with Cushion Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/5 border border-divide-lighter/10 flex-shrink-0">
            <div className="text-left">
              <div className="text-xs text-muted-foreground/60 uppercase tracking-wider">Plan basis</div>
              <div className="text-sm font-medium text-foreground/90">{formatPrice(planBasis)}</div>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <Checkbox
                id={`base-${holding.id}`}
                checked={plan.useBase}
                onCheckedChange={(checked) => onToggleBase(checked === true)}
                className="h-3.5 w-3.5"
              />
              <label
                htmlFor={`base-${holding.id}`}
                className="text-[10px] text-muted-foreground/70 cursor-pointer whitespace-nowrap"
              >
                +10% cushion
              </label>
            </div>
            <div className="group relative ml-1">
              <Info className="w-3 h-3 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors cursor-help" />
              <div className="absolute bottom-full right-0 mb-2 w-56 p-2 bg-secondary/95 backdrop-blur-sm border border-divide-lighter/30 rounded-lg text-[10px] text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10 shadow-lg">
                Targets use plan basis. When cushion is enabled, target prices are calculated from 10% above your average cost.
              </div>
            </div>
          </div>

          {/* Strategy Dropdown */}
          <div className="flex items-center gap-2 flex-shrink-0 relative">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Strategy</span>
            <Select
              value={plan.preset}
              onValueChange={(value) => onPresetChange(value as PresetType)}
            >
              <SelectTrigger className="w-32 h-8 text-xs bg-secondary/10 border-divide-lighter/20 hover:border-divide-lighter/40 transition-colors">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent className="z-50">
                {strategyOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expected Profit + % Gain (consolidated) */}
          <div className="text-right ml-auto flex-shrink-0 w-28">
            <div className={`font-semibold ${expectedProfit >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatPrice(expectedProfit)}
            </div>
            <div className={`text-xs ${percentGain >= 0 ? 'text-success/60' : 'text-danger/60'}`}>
              {percentGain >= 0 ? '+' : ''}{percentGain.toFixed(1)}% gain
            </div>
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
          {/* Helper text */}
          <div className="text-xs text-muted-foreground/60 mb-3 pl-1">
            These targets are based on your plan basis ({plan.useBase ? 'avg cost +10%' : 'avg cost'}).
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divide-lighter/10">
                  <th className="text-left py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Exit Point</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Sell % of position</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Target multiple</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Tokens to sell</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Target price</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Proceeds</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Profit from rung</th>
                </tr>
              </thead>
              <tbody>
                {plan.rungs.map((rung, idx) => {
                  const proceeds = (rung.tokensToSell ?? 0) * (rung.targetPrice ?? 0);
                  const profitFromSale = proceeds - ((rung.tokensToSell ?? 0) * avgCost);
                  const isRemaining = idx === plan.rungs.length - 1;
                  
                  return (
                    <tr key={idx} className="border-b border-divide-lighter/5 last:border-0 hover:bg-secondary/3 transition-colors duration-150">
                      <td className="py-3 px-3 text-sm text-foreground/80">
                        {isRemaining ? 'Remaining' : `Exit ${idx + 1}`}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isRemaining ? (
                          <div className="text-sm text-foreground/60 tabular-nums">{(rung.percent ?? 0).toFixed(1)}%</div>
                        ) : (
                          <Input
                            type="number"
                            value={rung.percent ?? 0}
                            onChange={(e) => onUpdateRung(idx, 'percent', parseFloat(e.target.value) || 0)}
                            className="w-20 h-7 text-right text-sm ml-auto tabular-nums"
                            min="0"
                            max="100"
                            disabled={isLocked}
                          />
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isRemaining ? (
                          <div className="text-sm text-foreground/60">—</div>
                        ) : (
                          <Input
                            type="number"
                            value={rung.multiplier ?? 0}
                            onChange={(e) => onUpdateRung(idx, 'multiplier', parseFloat(e.target.value) || 0)}
                            className="w-20 h-7 text-right text-sm ml-auto tabular-nums"
                            min="0"
                            step="0.1"
                            disabled={isLocked}
                          />
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-sm text-foreground/70 tabular-nums">
                        {formatTokensSmart(rung.tokensToSell ?? 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-sm font-medium text-foreground/90 tabular-nums">
                        {(rung.multiplier ?? 0) === 0 ? '—' : formatPrice(rung.targetPrice ?? 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-sm text-foreground/70 tabular-nums">
                        {(rung.multiplier ?? 0) === 0 ? '—' : formatPrice(proceeds)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {(rung.multiplier ?? 0) === 0 ? (
                          <span className="text-sm text-foreground/60">—</span>
                        ) : (
                          <span className={`text-sm font-medium tabular-nums ${profitFromSale >= 0 ? 'text-success' : 'text-danger'}`}>
                            {profitFromSale >= 0 ? '+' : ''}{formatPrice(profitFromSale)}
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
  const [exitPlans, setExitPlans] = useState<Record<string, ExitPlan>>(() => loadExitPlans());
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  
  // Track which holdings have been initialized to avoid re-initializing on price updates
  const initializedHoldingsRef = useRef<Set<string>>(new Set());

  // Persist exit plans to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(exitPlans).length > 0) {
      saveExitPlans(exitPlans);
    }
  }, [exitPlans]);

  // Fetch prices - only fetch, don't rebuild plans on every update
  useEffect(() => {
    const aggregator = getPriceAggregator();
    
    const fetchPrices = async () => {
      const symbols = store.holdings.map(h => h.symbol);
      if (symbols.length === 0) {
        setIsLoading(false);
        setHasFetchedOnce(true);
        return;
      }

      try {
        const quotes = await aggregator.getPrice(symbols);
        const priceMap: Record<string, ExtendedPriceQuote> = {};
        quotes.forEach(q => {
          priceMap[q.symbol] = q;
        });
        setPrices(priceMap);
        setHasFetchedOnce(true);
        setIsLoading(false);
      } catch (error) {
        console.error('[ExitStrategy] Failed to fetch prices:', error);
        setIsLoading(false);
        setHasFetchedOnce(true);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Reduced frequency to 30s

    return () => clearInterval(interval);
  }, []);

  // Initialize exit plans ONLY for new holdings - don't wipe existing plans
  useEffect(() => {
    if (!hasFetchedOnce) return; // Wait for first price fetch
    
    setExitPlans(prevPlans => {
      const newPlans = { ...prevPlans };
      let hasChanges = false;
      
      store.holdings.forEach(holding => {
        // Skip if already initialized
        if (initializedHoldingsRef.current.has(holding.id)) return;
        // Skip if plan already exists (from localStorage)
        if (newPlans[holding.id]) {
          initializedHoldingsRef.current.add(holding.id);
          return;
        }
        // Skip if no avgCost
        if (!holding.avgCost) return;
        
        const price = prices[holding.symbol];
        // Skip if no market cap data yet
        if (!price?.marketCapUsd) return;
        
        const category = getCategoryForHolding(holding, price.marketCapUsd);
        const plan = createDefaultExitPlan(holding, category);
        
        if (plan) {
          newPlans[holding.id] = plan;
          initializedHoldingsRef.current.add(holding.id);
          hasChanges = true;
        }
      });
      
      // Clean up plans for holdings that no longer exist
      const holdingIds = new Set(store.holdings.map(h => h.id));
      Object.keys(newPlans).forEach(planId => {
        if (!holdingIds.has(planId)) {
          delete newPlans[planId];
          initializedHoldingsRef.current.delete(planId);
          hasChanges = true;
        }
      });
      
      return hasChanges ? newPlans : prevPlans;
    });
  }, [prices, hasFetchedOnce]);

  // Broadcast exit plan updates to Portfolio page
  useEffect(() => {
    const event = new CustomEvent('exitPlansUpdated', { detail: exitPlans });
    window.dispatchEvent(event);
  }, [exitPlans]);

  const handlePresetChange = useCallback((holdingId: string, category: Category, preset: PresetType) => {
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const avgCost = holding.avgCost;
    
    setExitPlans(prev => {
      const currentPlan = prev[holdingId];
      const useBase = currentPlan?.useBase ?? true;
      const base = useBase ? avgCost * 1.1 : avgCost;
      
      // Get the appropriate template
      let template;
      if (preset === 'custom') {
        // Keep current rungs when switching to custom
        return {
          ...prev,
          [holdingId]: { ...currentPlan, preset: 'custom' }
        };
      } else if (preset === 'conservative') {
        template = category === 'blue-chip' ? BLUE_CHIP_CONSERVATIVE : 
                   category === 'mid-cap' ? MID_CAP_CONSERVATIVE : LOW_CAP_CONSERVATIVE;
      } else {
        template = category === 'mid-cap' ? MID_CAP_AGGRESSIVE : LOW_CAP_AGGRESSIVE;
      }
      
      const rungs = template.map((t, idx) => {
        const isRemaining = idx === template.length - 1;
        return {
          percent: t.percent,
          multiplier: t.multiplier,
          targetPrice: isRemaining || t.multiplier === 0 ? 0 : base * t.multiplier,
          tokensToSell: (holding.tokensOwned * t.percent) / 100
        };
      });
      
      return {
        ...prev,
        [holdingId]: { holdingId, useBase, preset, rungs }
      };
    });
    
    if (preset === 'custom') {
      toast.success('Custom mode enabled - you can now edit percentages and multipliers');
    } else {
      toast.success(`Applied ${preset.charAt(0).toUpperCase() + preset.slice(1)} preset`);
    }
  }, []);

  const handleUpdateRung = useCallback((holdingId: string, rungIndex: number, field: 'percent' | 'multiplier', value: number) => {
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const avgCost = holding.avgCost;
    
    setExitPlans(prev => {
      const plan = prev[holdingId];
      if (!plan) return prev;
      
      const base = plan.useBase ? avgCost * 1.1 : avgCost;
      const newRungs = [...plan.rungs];
      
      if (field === 'multiplier') {
        newRungs[rungIndex] = {
          ...newRungs[rungIndex],
          multiplier: value,
          targetPrice: value > 0 ? base * value : 0
        };
      } else {
        newRungs[rungIndex] = {
          ...newRungs[rungIndex],
          percent: value,
          tokensToSell: (holding.tokensOwned * value) / 100
        };
        
        // Recalculate remaining percentage (last rung)
        const sumOfExits = newRungs.slice(0, -1).reduce((sum, rung) => sum + (rung.percent ?? 0), 0);
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
  }, []);

  const handleToggleBase = useCallback((holdingId: string, useBase: boolean) => {
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const avgCost = holding.avgCost;
    
    setExitPlans(prev => {
      const plan = prev[holdingId];
      if (!plan) return prev;
      
      const base = useBase ? avgCost * 1.1 : avgCost;
      
      const newRungs = plan.rungs.map((rung, idx) => {
        const isRemaining = idx === plan.rungs.length - 1;
        return {
          ...rung,
          targetPrice: isRemaining || (rung.multiplier ?? 0) === 0 ? 0 : base * (rung.multiplier ?? 0)
        };
      });
      
      return {
        ...prev,
        [holdingId]: { ...plan, useBase, rungs: newRungs }
      };
    });
  }, []);

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
  }, [prices]);

  // Show loading state while fetching initial prices
  if (isLoading && !hasFetchedOnce) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Exit Strategy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan your exit ladder for each asset with customizable targets
          </p>
        </div>
        <Card className="p-12 text-center glass-panel border-divide-lighter/30">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading prices and market data...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Check if any holdings have avgCost and market cap data
  const holdingsWithData = store.holdings.filter(h => {
    if (!h.avgCost) return false;
    const price = prices[h.symbol];
    return price?.marketCapUsd && price.marketCapUsd > 0;
  });

  const hasEligibleHoldings = holdingsWithData.length > 0;

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
              <div className="px-4 py-3 border-b border-divide-lighter/15 flex items-center gap-3">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ 
                    backgroundColor: CATEGORY_COLORS[category],
                    boxShadow: `0 0 6px ${CATEGORY_COLORS[category]}50`
                  }}
                />
                <h2 className="text-base font-semibold font-heading">{CATEGORY_LABELS[category]}</h2>
                <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{holdings.length}</Badge>
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
                      onPresetChange={(preset) => handlePresetChange(holding.id, category, preset)}
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

      {store.holdings.length > 0 && !hasEligibleHoldings && hasFetchedOnce && (
        <Card className="p-12 text-center glass-panel border-divide-lighter/30">
          <p className="text-muted-foreground">
            No holdings with both average cost and market cap data. 
            Add an average cost to your holdings in the Portfolio page to create exit strategies.
          </p>
        </Card>
      )}
    </div>
  );
}
