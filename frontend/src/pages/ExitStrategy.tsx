import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCategoryForHolding, type Holding, type Category } from '@/lib/dataModel';
import { usePortfolioStore } from '@/lib/store';
import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { getPriceAggregator, type ExtendedPriceQuote } from '@/lib/priceService';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Info, Loader2 } from 'lucide-react';
import { formatPrice } from '@/lib/formatting';

const EXIT_PLANS_STORAGE_KEY = 'ysl-exit-plans';
const GLOBAL_CUSHION_KEY = 'ysl-global-cushion';
const LOGO_CACHE_KEY = 'ysl-logo-cache';

// Logo cache helpers
function loadLogoCache(): Record<string, string> {
  try {
    const cached = localStorage.getItem(LOGO_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('[ExitStrategy] Failed to load logo cache:', e);
  }
  return {};
}
function saveLogoCache(logos: Record<string, string>): void {
  try {
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(logos));
  } catch (e) {
    console.warn('[ExitStrategy] Failed to save logo cache:', e);
  }
}

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
  category: Category,
  useCushion: boolean = true
): ExitPlan | null {
  if (!holding.avgCost) return null;
  
  const avgCost = holding.avgCost;
  const base = useCushion ? avgCost * 1.1 : avgCost;
  
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
    useBase: useCushion,
    preset: defaultPreset,
    rungs
  };
}

interface AssetRowProps {
  holding: Holding;
  price: ExtendedPriceQuote | undefined;
  category: Category;
  plan: ExitPlan | undefined;
  logoUrl?: string;
  globalUseCushion: boolean;
  onPresetChange: (preset: PresetType) => void;
  onUpdateRung: (rungIndex: number, field: 'percent' | 'multiplier', value: number) => void;
}

const AssetRow = memo(({ 
  holding, 
  price, 
  category, 
  plan, 
  logoUrl,
  globalUseCushion,
  onPresetChange,
  onUpdateRung
}: AssetRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate values - guard against undefined/NaN
  const avgCost = holding.avgCost || 0;
  const planBasis = globalUseCushion ? avgCost * 1.1 : avgCost;
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
  
  // Determine plan status for display
  const planStatus = plan.preset === 'custom' ? 'Edited' : 'Template';
  
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

            {/* Logo + Symbol - prominent */}
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={holding.symbol}
                  className="h-7 w-7 rounded-full object-contain shadow-md"
                  onError={(e) => {
                    // Hide image on error, fallback will show
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-white shadow-md"
                style={{ 
                  backgroundColor: CATEGORY_COLORS[category],
                  display: logoUrl ? 'none' : 'flex'
                }}
              >
                {holding.symbol.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold font-heading text-base">
                {holding.symbol}
              </span>
            </div>
            
            {/* Plan Status Indicator */}
            <div className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium ${
              planStatus === 'Edited' 
                ? 'bg-amber-500/10 text-amber-400/80 border border-amber-500/20' 
                : 'bg-secondary/30 text-muted-foreground/60'
            }`}>
              {planStatus}
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

          {/* Plan Basis display (driven by global cushion setting) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/5 border border-divide-lighter/10 flex-shrink-0">
            <div className="text-left">
              <div className="text-xs text-muted-foreground/60 uppercase tracking-wider">Plan basis</div>
              <div className="text-sm font-medium text-foreground/90">{formatPrice(planBasis)}</div>
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
          {/* Helper text - explains what the rungs represent */}
          <div className="text-xs text-muted-foreground/60 mb-3 pl-1">
            Each rung is a price target where you'll sell a portion of your position. When the price hits that multiple, sell that percentage.
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
  // Use the portfolio store hook for principal-aware data access
  const { principal } = useInternetIdentity();
  const store = usePortfolioStore(principal);
  
  const [prices, setPrices] = useState<Record<string, ExtendedPriceQuote>>({});
  const [logos, setLogos] = useState<Record<string, string>>(() => loadLogoCache());
  const [exitPlans, setExitPlans] = useState<Record<string, ExitPlan>>(() => loadExitPlans());
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  
  // Global cushion toggle - affects all assets
  const [globalUseCushion, setGlobalUseCushion] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(GLOBAL_CUSHION_KEY);
      if (stored !== null) return stored === 'true';
      // Default to true (cushion enabled)
      return true;
    } catch {
      return true;
    }
  });
  
  // Persist global cushion setting
  useEffect(() => {
    try {
      localStorage.setItem(GLOBAL_CUSHION_KEY, String(globalUseCushion));
    } catch (e) {
      console.warn('[ExitStrategy] Failed to save global cushion setting:', e);
    }
  }, [globalUseCushion]);
  
  // Check if we have meaningful market cap data (not just prices with $0 market cap)
  const hasMarketCapData = useMemo(() => {
    const priceValues = Object.values(prices);
    if (priceValues.length === 0) return false;
    // At least one price should have a non-zero market cap
    return priceValues.some(p => p.marketCapUsd && p.marketCapUsd > 0);
  }, [prices]);
  
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

    // Fetch logos - uses stored CoinGecko IDs when available for reliable resolution
    const fetchLogos = async () => {
      const symbols = store.holdings.map(h => h.symbol);
      if (symbols.length === 0) return;
      try {
        // Build symbol -> CoinGecko ID map from holdings that have stored IDs
        const symbolToIdMap: Record<string, string> = {};
        for (const holding of store.holdings) {
          const symbol = holding.symbol.toUpperCase();
          if (holding.coingeckoId) {
            symbolToIdMap[symbol] = holding.coingeckoId;
          }
        }
        
        // Collect all logos before updating state
        let allLogos: Record<string, string> = {};
        
        // Fetch logos using CoinGecko IDs for holdings that have them
        const idsToFetch = Object.keys(symbolToIdMap);
        if (idsToFetch.length > 0) {
          const idBasedLogos = await aggregator.getLogosWithIds(symbolToIdMap);
          allLogos = { ...allLogos, ...idBasedLogos };
        }
        
        // For symbols without stored IDs, use the standard symbol-based lookup
        const symbolsWithoutIds = symbols.map(s => s.toUpperCase()).filter(s => !symbolToIdMap[s]);
        if (symbolsWithoutIds.length > 0) {
          const symbolBasedLogos = await aggregator.getLogos(symbolsWithoutIds);
          allLogos = { ...allLogos, ...symbolBasedLogos };
        }
        
        // Update state and save to cache
        setLogos(prev => {
          const updated = { ...prev, ...allLogos };
          saveLogoCache(updated);
          return updated;
        });
      } catch (error) {
        console.error('[ExitStrategy] Failed to fetch logos:', error);
      }
    };

    fetchPrices();
    fetchLogos();
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
        // Use fallback chain: live price > cached market cap > default to micro-cap (for new/unknown tokens)
        const marketCap = price?.marketCapUsd ?? holding.lastMarketCapUsd ?? 0;
        // If no market cap data, default to micro-cap category (safest assumption for unknown tokens)
        const category = marketCap > 0 
          ? getCategoryForHolding(holding, marketCap) 
          : 'micro-cap' as Category;
        const plan = createDefaultExitPlan(holding, category, globalUseCushion);
        
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
  }, [prices, hasFetchedOnce, globalUseCushion]);

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
      const base = globalUseCushion ? avgCost * 1.1 : avgCost;
      
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
        [holdingId]: { holdingId, useBase: globalUseCushion, preset, rungs }
      };
    });
    
    if (preset === 'custom') {
      toast.success('Custom mode enabled - you can now edit percentages and multipliers');
    } else {
      toast.success(`Applied ${preset.charAt(0).toUpperCase() + preset.slice(1)} preset`);
    }
  }, [globalUseCushion]);

  const handleUpdateRung = useCallback((holdingId: string, rungIndex: number, field: 'percent' | 'multiplier', value: number) => {
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const avgCost = holding.avgCost;
    
    setExitPlans(prev => {
      const plan = prev[holdingId];
      if (!plan) return prev;
      
      const base = globalUseCushion ? avgCost * 1.1 : avgCost;
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
  }, [globalUseCushion]);

  // Recalculate all target prices when global cushion changes
  useEffect(() => {
    setExitPlans(prev => {
      const updated: Record<string, ExitPlan> = {};
      let hasAnyChanges = false;
      
      Object.keys(prev).forEach(holdingId => {
        const plan = prev[holdingId];
        const holding = store.holdings.find(h => h.id === holdingId);
        if (!plan || !holding?.avgCost) {
          updated[holdingId] = plan;
          return;
        }
        
        const avgCost = holding.avgCost;
        const base = globalUseCushion ? avgCost * 1.1 : avgCost;
        
        const newRungs = plan.rungs.map((rung, idx) => {
          const isRemaining = idx === plan.rungs.length - 1;
          const newTargetPrice = isRemaining || (rung.multiplier ?? 0) === 0 ? 0 : base * (rung.multiplier ?? 0);
          
          if (Math.abs(newTargetPrice - (rung.targetPrice ?? 0)) > 0.01) {
            hasAnyChanges = true;
          }
          
          return {
            ...rung,
            targetPrice: newTargetPrice
          };
        });
        
        updated[holdingId] = { ...plan, rungs: newRungs };
      });
      
      return hasAnyChanges ? updated : prev;
    });
  }, [globalUseCushion]);

  // Sync tokensToSell with current holdings tokensOwned
  // This handles cases where tokens were updated after exit plan was created
  useEffect(() => {
    setExitPlans(prev => {
      const updated: Record<string, ExitPlan> = {};
      let hasAnyChanges = false;
      
      Object.keys(prev).forEach(holdingId => {
        const plan = prev[holdingId];
        const holding = store.holdings.find(h => h.id === holdingId);
        if (!plan || !holding) {
          updated[holdingId] = plan;
          return;
        }
        
        const newRungs = plan.rungs.map(rung => {
          const expectedTokens = (holding.tokensOwned * (rung.percent ?? 0)) / 100;
          
          // Check if tokensToSell needs to be updated (allow small floating point differences)
          if (Math.abs(expectedTokens - (rung.tokensToSell ?? 0)) > 0.001) {
            hasAnyChanges = true;
            return {
              ...rung,
              tokensToSell: expectedTokens
            };
          }
          
          return rung;
        });
        
        updated[holdingId] = hasAnyChanges ? { ...plan, rungs: newRungs } : plan;
      });
      
      return hasAnyChanges ? updated : prev;
    });
  }, [store.holdings]);

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
      // Only include holdings with avgCost (required for exit planning)
      if (!holding.avgCost) return;
      
      const price = prices[holding.symbol];
      // Use fallback chain: live market cap > cached market cap > default to micro-cap
      const marketCap = price?.marketCapUsd ?? holding.lastMarketCapUsd ?? 0;
      const category = marketCap > 0 
        ? getCategoryForHolding(holding, marketCap) 
        : 'micro-cap' as Category;
      groups[category].push(holding);
    });

    // Sort each category by position value (tokens * current price), highest first
    Object.keys(groups).forEach(cat => {
      const category = cat as Category;
      groups[category].sort((a, b) => {
        const priceA = prices[a.symbol]?.priceUsd ?? 0;
        const priceB = prices[b.symbol]?.priceUsd ?? 0;
        const valueA = a.tokensOwned * priceA;
        const valueB = b.tokensOwned * priceB;
        return valueB - valueA; // Descending order (highest value first)
      });
    });

    return groups;
  }, [prices, store.holdings]);

  // Calculate summary stats for custom vs template plans (must be before early returns)
  const planStats = useMemo(() => {
    let customCount = 0;
    let templateCount = 0;
    
    Object.values(exitPlans).forEach(plan => {
      if (plan.preset === 'custom') {
        customCount++;
      } else {
        templateCount++;
      }
    });
    
    return { customCount, templateCount, total: customCount + templateCount };
  }, [exitPlans]);

  // Show loading state while fetching initial prices
  // We no longer wait for market cap data since we default to micro-cap for unknown tokens
  const showLoading = isLoading && !hasFetchedOnce;
  
  if (showLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Exit Strategy</h1>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Set your exits now, so you can take profits later without emotion.
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

  // Check if any holdings have avgCost (the only requirement for exit planning)
  const holdingsWithData = store.holdings.filter(h => !!h.avgCost);

  const hasEligibleHoldings = holdingsWithData.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Exit Strategy</h1>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Set your exits now, so you can take profits later without emotion.
          </p>
        </div>
        {/* Right section: Global cushion toggle + Summary status */}
        <div className="flex items-center gap-6">
          {/* Global Plan Basis Cushion Toggle */}
          <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/5 border border-divide-lighter/10 cursor-pointer hover:bg-secondary/10 transition-colors"
            onClick={() => setGlobalUseCushion(prev => !prev)}
          >
            <span className="text-xs text-muted-foreground/60">Plan basis</span>
            <Checkbox
              id="global-cushion"
              checked={globalUseCushion}
              onCheckedChange={(checked) => setGlobalUseCushion(checked === true)}
              className="h-3.5 w-3.5 pointer-events-none"
            />
            <span className="text-xs text-muted-foreground/80 whitespace-nowrap">
              +10% cushion
            </span>
            <div className="group relative ml-1" onClick={(e) => e.stopPropagation()}>
              <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors cursor-help" />
              <div className="absolute bottom-full right-0 mb-2 w-72 p-3 bg-secondary/95 backdrop-blur-sm border border-divide-lighter/30 rounded-lg text-xs text-muted-foreground opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 shadow-lg">
                <div className="font-semibold text-foreground/90 mb-1.5">Plan basis</div>
                <p className="leading-relaxed">
                  Exit targets are calculated from the Plan basis price. By default, Plan basis is your average cost per token. 
                  If +10% cushion is enabled, we set Plan basis to 10% above your average cost to leave room for taxes, fees, and slippage. 
                  Turn it off to calculate targets from your true average cost.
                </p>
              </div>
            </div>
          </div>
          
          {/* Summary status */}
          {planStats.total > 0 && (
            <div className="text-xs text-muted-foreground/60">
              {planStats.customCount === 0 ? (
                <span>All {planStats.total} assets use templates</span>
              ) : planStats.templateCount === 0 ? (
                <span>All {planStats.total} assets have custom edits</span>
              ) : (
                <span>{planStats.customCount} of {planStats.total} assets edited</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Holdings by Category */}
      <div className="space-y-6">
        {(['blue-chip', 'mid-cap', 'low-cap', 'micro-cap'] as Category[]).map(category => {
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
                  const logoUrl = logos[holding.symbol.toUpperCase()];

                  return (
                    <AssetRow
                      key={holding.id}
                      holding={holding}
                      price={price}
                      category={category}
                      plan={plan}
                      logoUrl={logoUrl}
                      globalUseCushion={globalUseCushion}
                      onPresetChange={(preset) => handlePresetChange(holding.id, category, preset)}
                      onUpdateRung={(rungIndex, field, value) => handleUpdateRung(holding.id, rungIndex, field, value)}
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

      {store.holdings.length > 0 && !hasEligibleHoldings && (
        <Card className="p-12 text-center glass-panel border-divide-lighter/30">
          <p className="text-muted-foreground">
            No holdings with average cost data. 
            Add an average cost to your holdings in the Portfolio page to create exit strategies.
          </p>
        </Card>
      )}
    </div>
  );
}
