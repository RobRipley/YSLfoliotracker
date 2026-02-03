import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { getCategoryForHolding, type Holding, type Category } from '@/lib/dataModel';
import { usePortfolioStore } from '@/lib/store';
import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { getPriceAggregator, type ExtendedPriceQuote } from '@/lib/priceService';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Loader2, Settings2 } from 'lucide-react';
import { formatPrice } from '@/lib/formatting';
import {
  CATEGORY_LABELS,
  getCategoryColor,
} from '@/lib/categoryColors';

const EXIT_PLANS_STORAGE_KEY = 'ysl-exit-plans';
const PLAN_BASIS_CONFIG_KEY = 'ysl-plan-basis-configs';
const LOGO_CACHE_KEY = 'ysl-logo-cache';

// Plan Basis Configuration Types
type PlanBasisMode = 'avg_cost' | 'avg_cushion' | 'custom';

interface PlanBasisConfig {
  mode: PlanBasisMode;
  cushionPct?: number;   // for avg_cushion mode
  customPrice?: number;  // only for custom mode
}

// Default config - avg + cushion at 10%
const DEFAULT_PLAN_BASIS_CONFIG: PlanBasisConfig = {
  mode: 'avg_cushion',
  cushionPct: 10,
};

// Plan Basis Config Storage helpers
function loadPlanBasisConfigs(): Record<string, PlanBasisConfig> {
  try {
    const stored = localStorage.getItem(PLAN_BASIS_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[ExitStrategy] Failed to load plan basis configs:', e);
  }
  return {};
}

function savePlanBasisConfigs(configs: Record<string, PlanBasisConfig>): void {
  try {
    localStorage.setItem(PLAN_BASIS_CONFIG_KEY, JSON.stringify(configs));
  } catch (e) {
    console.warn('[ExitStrategy] Failed to save plan basis configs:', e);
  }
}

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
 */
function formatTokensSmart(value: number, maxPrecision: number = 8): string {
  if (value === 0) return '0';
  if (isNaN(value) || !isFinite(value)) return '0';
  
  const absValue = Math.abs(value);
  let precision = maxPrecision;
  
  if (absValue >= 10000) {
    precision = 0;
  } else if (absValue >= 1000) {
    precision = 1;
  } else if (absValue >= 100) {
    precision = 2;
  } else if (absValue >= 1) {
    precision = 4;
  } else if (absValue >= 0.0001) {
    precision = 6;
  }
  
  const formatted = value.toFixed(precision);
  
  if (formatted.includes('.')) {
    const trimmed = formatted.replace(/\.?0+$/, '');
    return trimmed === '' ? '0' : trimmed;
  }
  
  return formatted;
}

/**
 * Calculate plan basis from config
 */
function calculatePlanBasis(
  config: PlanBasisConfig,
  avgCost: number,
  currentPrice: number
): number {
  switch (config.mode) {
    case 'avg_cost':
      return avgCost;
    case 'avg_cushion':
      const cushion = config.cushionPct ?? 10;
      return avgCost * (1 + cushion / 100);
    case 'custom':
      return config.customPrice ?? avgCost;
    default:
      return avgCost;
  }
}

// Create default exit plan for a holding
function createDefaultExitPlan(
  holding: Holding,
  category: Category,
  planBasis: number
): ExitPlan | null {
  if (!holding.avgCost) return null;
  
  let template = category === 'blue-chip' ? BLUE_CHIP_CONSERVATIVE : 
                 category === 'mid-cap' ? MID_CAP_AGGRESSIVE : LOW_CAP_AGGRESSIVE;
  
  const defaultPreset: PresetType = category === 'blue-chip' ? 'conservative' : 'aggressive';
  
  const rungs = template.map((t, idx) => {
    const isRemaining = idx === template.length - 1;
    return {
      percent: t.percent,
      multiplier: t.multiplier,
      targetPrice: isRemaining || t.multiplier === 0 ? 0 : planBasis * t.multiplier,
      tokensToSell: (holding.tokensOwned * t.percent) / 100
    };
  });
  
  return {
    holdingId: holding.id,
    useBase: true,
    preset: defaultPreset,
    rungs
  };
}

// ============================================================================
// Plan Basis Popover Component
// ============================================================================
interface PlanBasisPopoverProps {
  symbol: string;
  holdingId: string;
  config: PlanBasisConfig;
  avgCost: number;
  currentPrice: number;
  onSave: (config: PlanBasisConfig) => void;
}

const PlanBasisPopover = memo(({ 
  symbol, 
  holdingId, 
  config, 
  avgCost, 
  currentPrice, 
  onSave 
}: PlanBasisPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState<PlanBasisConfig>(config);
  
  // Reset local state when popover opens
  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
    }
  }, [isOpen, config]);

  const handleModeChange = (mode: PlanBasisMode) => {
    const newConfig: PlanBasisConfig = {
      ...localConfig,
      mode,
      // Preserve cushionPct default when switching to avg_cushion
      cushionPct: mode === 'avg_cushion' ? (localConfig.cushionPct ?? 10) : localConfig.cushionPct,
    };
    setLocalConfig(newConfig);
    // Auto-save on mode change
    onSave(newConfig);
  };

  const handleCushionChange = (value: string) => {
    const pct = parseFloat(value);
    if (!isNaN(pct) && pct >= 0) {
      const newConfig = { ...localConfig, cushionPct: pct };
      setLocalConfig(newConfig);
      // Auto-save on cushion change
      onSave(newConfig);
    }
  };

  const handleCustomPriceChange = (value: string) => {
    const price = parseFloat(value);
    if (!isNaN(price) && price >= 0) {
      const newConfig = { ...localConfig, customPrice: price };
      setLocalConfig(newConfig);
      // Auto-save on custom price change
      onSave(newConfig);
    }
  };

  // Calculate live preview value based on current local config
  const liveValue = calculatePlanBasis(localConfig, avgCost, currentPrice);
  
  // Display value (use calculated value from saved config for the button)
  const displayValue = calculatePlanBasis(config, avgCost, currentPrice);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className="w-24 text-right text-sm tabular-nums text-foreground/80 flex-shrink-0 group cursor-pointer hover:text-foreground transition-colors duration-150 flex items-center justify-end gap-1"
                onClick={() => setIsOpen(true)}
              >
                <span className="group-hover:underline">{formatPrice(displayValue)}</span>
                <Settings2 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity duration-150" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            Click to adjust plan basis
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <PopoverContent 
        className="p-2.5"
        align="start"
        side="bottom"
        style={{ width: 'auto', minWidth: '140px', maxWidth: '180px' }}
      >
        <div className="space-y-2">
          {/* Header with live value */}
          <div className="pb-1 border-b border-slate-700/50">
            <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Plan basis for {symbol}</div>
            <div className="text-sm font-semibold text-foreground tabular-nums">{formatPrice(liveValue)}</div>
          </div>
          
          {/* Radio Group - very compact */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 cursor-pointer group py-0.5">
              <input
                type="radio"
                name={`plan-basis-mode-${holdingId}`}
                checked={localConfig.mode === 'avg_cost'}
                onChange={() => handleModeChange('avg_cost')}
                className="w-3 h-3 text-indigo-500 focus:ring-indigo-400"
              />
              <span className="text-xs text-foreground/80 group-hover:text-foreground transition-colors whitespace-nowrap">
                Average cost
              </span>
            </label>
            
            <div>
              <label className="flex items-center gap-1.5 cursor-pointer group py-0.5">
                <input
                  type="radio"
                  name={`plan-basis-mode-${holdingId}`}
                  checked={localConfig.mode === 'avg_cushion'}
                  onChange={() => handleModeChange('avg_cushion')}
                  className="w-3 h-3 text-indigo-500 focus:ring-indigo-400"
                />
                <span className="text-xs text-foreground/80 group-hover:text-foreground transition-colors whitespace-nowrap">
                  Avg + cushion
                </span>
              </label>
              
              {/* Cushion input - shown when avg_cushion is selected */}
              {localConfig.mode === 'avg_cushion' && (
                <div className="mt-1 ml-4 flex items-center gap-1">
                  <Input
                    type="number"
                    value={localConfig.cushionPct ?? 10}
                    onChange={(e) => handleCushionChange(e.target.value)}
                    className="w-12 h-5 text-[11px] text-right tabular-nums px-1.5"
                    min="0"
                    max="100"
                    step="1"
                  />
                  <span className="text-[10px] text-muted-foreground">%</span>
                </div>
              )}
            </div>
            
            <div>
              <label className="flex items-center gap-1.5 cursor-pointer group py-0.5">
                <input
                  type="radio"
                  name={`plan-basis-mode-${holdingId}`}
                  checked={localConfig.mode === 'custom'}
                  onChange={() => handleModeChange('custom')}
                  className="w-3 h-3 text-indigo-500 focus:ring-indigo-400"
                />
                <span className="text-xs text-foreground/80 group-hover:text-foreground transition-colors whitespace-nowrap">
                  Custom
                </span>
              </label>
              
              {/* Custom Price Input - shown when custom is selected */}
              {localConfig.mode === 'custom' && (
                <div className="mt-1 ml-4 flex items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={localConfig.customPrice ?? avgCost}
                    onChange={(e) => handleCustomPriceChange(e.target.value)}
                    className="w-16 h-5 text-[11px] text-right tabular-nums px-1.5"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

PlanBasisPopover.displayName = 'PlanBasisPopover';

// ============================================================================
// Asset Row Component
// ============================================================================
interface AssetRowProps {
  holding: Holding;
  price: ExtendedPriceQuote | undefined;
  category: Category;
  plan: ExitPlan | undefined;
  logoUrl?: string;
  planBasisConfig: PlanBasisConfig;
  onPlanBasisChange: (config: PlanBasisConfig) => void;
  onPresetChange: (preset: PresetType) => void;
  onUpdateRung: (rungIndex: number, field: 'percent' | 'multiplier', value: number) => void;
}

const AssetRow = memo(({ 
  holding, 
  price, 
  category, 
  plan, 
  logoUrl,
  planBasisConfig,
  onPlanBasisChange,
  onPresetChange,
  onUpdateRung
}: AssetRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const avgCost = holding.avgCost || 0;
  const currentPrice = price?.priceUsd ?? 0;
  const planBasis = calculatePlanBasis(planBasisConfig, avgCost, currentPrice);
  
  const positionValue = holding.tokensOwned * currentPrice;
  const totalCost = holding.tokensOwned * avgCost;
  const unrealizedPnL = positionValue - totalCost;

  const { expectedProfit } = useMemo(() => {
    if (!plan || !plan.rungs) return { expectedProfit: 0 };
    
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
    
    return { expectedProfit: profit };
  }, [plan, totalCost]);

  if (!holding.avgCost || !plan) return null;

  const isLocked = plan.preset !== 'custom';
  
  const strategyOptions = category === 'blue-chip' 
    ? [{ value: 'conservative', label: 'Conservative' }, { value: 'custom', label: 'Custom' }]
    : [{ value: 'conservative', label: 'Conservative' }, { value: 'aggressive', label: 'Aggressive' }, { value: 'custom', label: 'Custom' }];

  // Get color from centralized source
  const catColor = getCategoryColor(category);

  return (
    <div className="border-b border-divide-lighter/10 last:border-0">
      {/* Data Row - values only, no labels */}
      <div className="px-4 py-3 hover:bg-secondary/4 transition-colors duration-150">
        <div className="flex items-center gap-4">
          {/* Expand Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-secondary/10 rounded-md transition-colors duration-150 flex-shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {/* Asset: Logo + Symbol */}
          <div className="flex items-center gap-2 w-24 flex-shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={holding.symbol}
                className="h-6 w-6 rounded-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ 
                backgroundColor: catColor,
                display: logoUrl ? 'none' : 'flex'
              }}
            >
              {holding.symbol.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-sm">{holding.symbol}</span>
          </div>

          {/* LEFT GROUP: Descriptive metrics */}
          {/* Tokens */}
          <div className="w-24 text-right text-sm tabular-nums text-foreground/80 flex-shrink-0">
            {formatTokensSmart(holding.tokensOwned)}
          </div>

          {/* Position Value */}
          <div className="w-28 text-right text-sm font-medium tabular-nums flex-shrink-0">
            {formatPrice(positionValue)}
          </div>
          
          {/* Total Cost */}
          <div className="w-24 text-right text-sm tabular-nums text-foreground/70 flex-shrink-0">
            {formatPrice(totalCost)}
          </div>
          
          {/* Unrealized P/L */}
          <div className={`w-28 text-right text-sm font-medium tabular-nums flex-shrink-0 ${unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
            {unrealizedPnL >= 0 ? '+' : ''}{formatPrice(unrealizedPnL)}
          </div>

          {/* Spacer */}
          <div className="flex-grow min-w-4" />

          {/* RIGHT GROUP: Planning & outcome metrics */}
          {/* Plan Basis - Now clickable with popover */}
          <PlanBasisPopover
            symbol={holding.symbol}
            holdingId={holding.id}
            config={planBasisConfig}
            avgCost={avgCost}
            currentPrice={currentPrice}
            onSave={onPlanBasisChange}
          />

          {/* Strategy Dropdown */}
          <div className="w-32 flex-shrink-0">
            <Select
              value={plan.preset}
              onValueChange={(value) => onPresetChange(value as PresetType)}
            >
              <SelectTrigger className="w-full h-8 text-xs bg-secondary/10 border-divide-lighter/20 hover:border-divide-lighter/40 transition-colors">
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

          {/* Expected Profit */}
          <div className={`w-28 text-right font-semibold tabular-nums flex-shrink-0 ${expectedProfit >= 0 ? 'text-success' : 'text-danger'}`}>
            {expectedProfit >= 0 ? '+' : ''}{formatPrice(expectedProfit)}
          </div>
        </div>
      </div>

      {/* Expanded Exit Ladder Table */}
      {isExpanded && (
        <div 
          className="px-4 pb-4 overflow-hidden"
          style={{ animation: 'expandRow 180ms ease-out' }}
        >
          <div className="text-xs text-muted-foreground/60 mb-3 pl-1">
            Each rung is a price target where you'll sell a portion of your position.
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divide-lighter/10">
                  <th className="text-left py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Exit Point</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Sell %</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Multiple</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Tokens</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Target Price</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Proceeds</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Profit</th>
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

// ============================================================================
// Main Exit Strategy Component
// ============================================================================
export function ExitStrategy() {
  const { principal } = useInternetIdentity();
  const store = usePortfolioStore(principal);
  
  const [prices, setPrices] = useState<Record<string, ExtendedPriceQuote>>({});
  const [logos, setLogos] = useState<Record<string, string>>(() => loadLogoCache());
  const [exitPlans, setExitPlans] = useState<Record<string, ExitPlan>>(() => loadExitPlans());
  const [planBasisConfigs, setPlanBasisConfigs] = useState<Record<string, PlanBasisConfig>>(() => loadPlanBasisConfigs());
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  
  const initializedHoldingsRef = useRef<Set<string>>(new Set());

  // Memoize symbols to avoid unnecessary fetches
  const symbols = useMemo(
    () => Array.from(new Set(store.holdings.map(h => h.symbol.toUpperCase()))),
    [store.holdings]
  );

  // Persist exit plans
  useEffect(() => {
    if (Object.keys(exitPlans).length > 0) {
      saveExitPlans(exitPlans);
    }
  }, [exitPlans]);

  // Persist plan basis configs
  useEffect(() => {
    savePlanBasisConfigs(planBasisConfigs);
  }, [planBasisConfigs]);

  // Fetch prices - memoized callback
  const fetchPrices = useCallback(async () => {
    const aggregator = getPriceAggregator();
    
    if (symbols.length === 0) {
      setIsLoading(false);
      setHasFetchedOnce(true);
      return;
    }

    try {
      const quotes = await aggregator.getPrice(symbols);
      const priceMap: Record<string, ExtendedPriceQuote> = {};
      quotes.forEach(q => {
        priceMap[q.symbol.toUpperCase()] = q;
      });
      setPrices(priceMap);
      setHasFetchedOnce(true);
      setIsLoading(false);
    } catch (error) {
      console.error('[ExitStrategy] Failed to fetch prices:', error);
      setIsLoading(false);
      setHasFetchedOnce(true);
    }
  }, [symbols]);

  // Fetch logos - memoized callback
  const fetchLogos = useCallback(async () => {
    const aggregator = getPriceAggregator();
    
    if (symbols.length === 0) return;
    try {
      const symbolToIdMap: Record<string, string> = {};
      for (const holding of store.holdings) {
        const symbol = holding.symbol.toUpperCase();
        if (holding.coingeckoId) {
          symbolToIdMap[symbol] = holding.coingeckoId;
        }
      }
      
      let allLogos: Record<string, string> = {};
      
      const idsToFetch = Object.keys(symbolToIdMap);
      if (idsToFetch.length > 0) {
        const idBasedLogos = await aggregator.getLogosWithIds(symbolToIdMap);
        allLogos = { ...allLogos, ...idBasedLogos };
      }
      
      const symbolsWithoutIds = symbols.filter(s => !symbolToIdMap[s]);
      if (symbolsWithoutIds.length > 0) {
        const symbolBasedLogos = await aggregator.getLogos(symbolsWithoutIds);
        allLogos = { ...allLogos, ...symbolBasedLogos };
      }
      
      setLogos(prev => {
        const updated = { ...prev, ...allLogos };
        saveLogoCache(updated);
        return updated;
      });
    } catch (error) {
      console.error('[ExitStrategy] Failed to fetch logos:', error);
    }
  }, [symbols, store.holdings]);

  // Effect to fetch prices and logos
  useEffect(() => {
    fetchPrices();
    fetchLogos();
    const interval = setInterval(fetchPrices, 30000);

    return () => clearInterval(interval);
  }, [fetchPrices, fetchLogos]);

  // Get plan basis config for a holding (with default fallback)
  const getPlanBasisConfig = useCallback((holdingId: string): PlanBasisConfig => {
    return planBasisConfigs[holdingId] ?? { ...DEFAULT_PLAN_BASIS_CONFIG };
  }, [planBasisConfigs]);

  // Initialize exit plans for new holdings
  useEffect(() => {
    if (!hasFetchedOnce) return;
    
    setExitPlans(prevPlans => {
      const newPlans = { ...prevPlans };
      let hasChanges = false;
      
      store.holdings.forEach(holding => {
        if (initializedHoldingsRef.current.has(holding.id)) return;
        if (newPlans[holding.id]) {
          initializedHoldingsRef.current.add(holding.id);
          return;
        }
        if (!holding.avgCost) return;
        
        const price = prices[holding.symbol.toUpperCase()];
        const marketCap = price?.marketCapUsd ?? holding.lastMarketCapUsd ?? 0;
        const category = marketCap > 0 
          ? getCategoryForHolding(holding, marketCap) 
          : 'micro-cap' as Category;
        
        // Get plan basis config for this holding
        const config = getPlanBasisConfig(holding.id);
        const currentPrice = price?.priceUsd ?? 0;
        const planBasis = calculatePlanBasis(config, holding.avgCost, currentPrice);
        
        const plan = createDefaultExitPlan(holding, category, planBasis);
        
        if (plan) {
          newPlans[holding.id] = plan;
          initializedHoldingsRef.current.add(holding.id);
          hasChanges = true;
        }
      });
      
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
  }, [prices, hasFetchedOnce, getPlanBasisConfig]);

  // Broadcast exit plans updates
  useEffect(() => {
    const event = new CustomEvent('exitPlansUpdated', { detail: exitPlans });
    window.dispatchEvent(event);
  }, [exitPlans]);

  // Handle plan basis config change for a holding
  const handlePlanBasisChange = useCallback((holdingId: string, config: PlanBasisConfig) => {
    // Update config
    setPlanBasisConfigs(prev => ({
      ...prev,
      [holdingId]: config
    }));
    
    // Recalculate exit plan with new plan basis
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const price = prices[holding.symbol.toUpperCase()];
    const currentPrice = price?.priceUsd ?? 0;
    const newPlanBasis = calculatePlanBasis(config, holding.avgCost, currentPrice);
    
    setExitPlans(prev => {
      const plan = prev[holdingId];
      if (!plan) return prev;
      
      const newRungs = plan.rungs.map((rung, idx) => {
        const isRemaining = idx === plan.rungs.length - 1;
        return {
          ...rung,
          targetPrice: isRemaining || (rung.multiplier ?? 0) === 0 ? 0 : newPlanBasis * (rung.multiplier ?? 0)
        };
      });
      
      return {
        ...prev,
        [holdingId]: { ...plan, rungs: newRungs }
      };
    });
  }, [prices]);

  // Handle preset change
  const handlePresetChange = useCallback((holdingId: string, category: Category, preset: PresetType) => {
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const price = prices[holding.symbol.toUpperCase()];
    const currentPrice = price?.priceUsd ?? 0;
    const config = getPlanBasisConfig(holdingId);
    const planBasis = calculatePlanBasis(config, holding.avgCost, currentPrice);
    
    setExitPlans(prev => {
      const currentPlan = prev[holdingId];
      
      let template;
      if (preset === 'custom') {
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
          targetPrice: isRemaining || t.multiplier === 0 ? 0 : planBasis * t.multiplier,
          tokensToSell: (holding.tokensOwned * t.percent) / 100
        };
      });
      
      return {
        ...prev,
        [holdingId]: { holdingId, useBase: true, preset, rungs }
      };
    });
    
    if (preset === 'custom') {
      toast.success('Custom mode enabled - you can now edit percentages and multipliers');
    } else {
      toast.success(`Applied ${preset.charAt(0).toUpperCase() + preset.slice(1)} preset`);
    }
  }, [prices, getPlanBasisConfig]);

  // Handle rung updates
  const handleUpdateRung = useCallback((holdingId: string, rungIndex: number, field: 'percent' | 'multiplier', value: number) => {
    const holding = store.holdings.find(h => h.id === holdingId);
    if (!holding?.avgCost) return;
    
    const price = prices[holding.symbol.toUpperCase()];
    const currentPrice = price?.priceUsd ?? 0;
    const config = getPlanBasisConfig(holdingId);
    const planBasis = calculatePlanBasis(config, holding.avgCost, currentPrice);
    
    setExitPlans(prev => {
      const plan = prev[holdingId];
      if (!plan) return prev;
      
      const newRungs = [...plan.rungs];
      
      if (field === 'multiplier') {
        newRungs[rungIndex] = {
          ...newRungs[rungIndex],
          multiplier: value,
          targetPrice: value > 0 ? planBasis * value : 0
        };
      } else {
        newRungs[rungIndex] = {
          ...newRungs[rungIndex],
          percent: value,
          tokensToSell: (holding.tokensOwned * value) / 100
        };
        
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
  }, [prices, getPlanBasisConfig]);

  // Sync tokensToSell when holdings change
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

  // Group holdings by category
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
      if (!holding.avgCost) return;
      
      const price = prices[holding.symbol.toUpperCase()];
      const marketCap = price?.marketCapUsd ?? holding.lastMarketCapUsd ?? 0;
      const category = marketCap > 0 
        ? getCategoryForHolding(holding, marketCap) 
        : 'micro-cap' as Category;
      groups[category].push(holding);
    });

    Object.keys(groups).forEach(cat => {
      const category = cat as Category;
      groups[category].sort((a, b) => {
        const priceA = prices[a.symbol.toUpperCase()]?.priceUsd ?? 0;
        const priceB = prices[b.symbol.toUpperCase()]?.priceUsd ?? 0;
        const valueA = a.tokensOwned * priceA;
        const valueB = b.tokensOwned * priceB;
        return valueB - valueA;
      });
    });

    return groups;
  }, [prices, store.holdings]);

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

  const holdingsWithData = store.holdings.filter(h => !!h.avgCost);
  const hasEligibleHoldings = holdingsWithData.length > 0;

  return (
    <div className="space-y-6">
      {/* Header - removed global cushion toggle */}
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Exit Strategy</h1>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Set your exits now, so you can take profits later without emotion.
        </p>
      </div>

      {/* Holdings by Category */}
      <div className="space-y-6">
        {(['blue-chip', 'mid-cap', 'low-cap', 'micro-cap'] as Category[]).map(category => {
          const holdings = groupedHoldings[category];
          if (holdings.length === 0) return null;

          const catColor = getCategoryColor(category);
          const catLabel = CATEGORY_LABELS[category];

          return (
            <Card key={category} className="overflow-visible border-divide-lighter/30 glass-panel shadow-minimal">
              {/* Category Header with column labels */}
              <div className="px-4 py-3 border-b border-divide-lighter/15">
                {/* Category name row */}
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ 
                      backgroundColor: catColor,
                      boxShadow: `0 0 6px ${catColor}50`
                    }}
                  />
                  <h2 className="text-base font-semibold font-heading">{catLabel}</h2>
                  <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{holdings.length}</Badge>
                </div>
                
                {/* Column headers row */}
                <div className="flex items-center gap-4 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                  {/* Expand button placeholder */}
                  <div className="w-8 flex-shrink-0" />
                  {/* Asset */}
                  <div className="w-24 flex-shrink-0">Asset</div>
                  {/* LEFT GROUP */}
                  <div className="w-24 text-right flex-shrink-0">Tokens</div>
                  <div className="w-28 text-right flex-shrink-0">Position Value</div>
                  <div className="w-24 text-right flex-shrink-0">Total Cost</div>
                  <div className="w-28 text-right flex-shrink-0">Unrealized P/L</div>
                  {/* Spacer */}
                  <div className="flex-grow min-w-4" />
                  {/* RIGHT GROUP */}
                  <div className="w-24 text-right flex-shrink-0">Plan Basis</div>
                  <div className="w-32 text-center flex-shrink-0">Strategy</div>
                  <div className="w-28 text-right flex-shrink-0">Expected Profit</div>
                </div>
              </div>

              <div className="overflow-visible">
                {holdings.map(holding => {
                  const price = prices[holding.symbol.toUpperCase()];
                  const plan = exitPlans[holding.id];
                  const logoUrl = logos[holding.symbol.toUpperCase()];
                  const planBasisConfig = getPlanBasisConfig(holding.id);

                  return (
                    <AssetRow
                      key={holding.id}
                      holding={holding}
                      price={price}
                      category={category}
                      plan={plan}
                      logoUrl={logoUrl}
                      planBasisConfig={planBasisConfig}
                      onPlanBasisChange={(config) => handlePlanBasisChange(holding.id, config)}
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
