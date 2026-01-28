import { useState, useMemo, useCallback, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, ChevronRight, Edit, Trash2, Lock, Unlock, Info, Settings, Target, Plus, Pencil, Check, Loader2, DollarSign } from 'lucide-react';
import { type Holding, type Category, valueUsd, share } from '@/lib/dataModel';
import { type ExtendedPriceQuote } from '@/lib/priceService';
import { saveUIPreferences, loadUIPreferences } from '@/lib/uiPreferences';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const CATEGORY_LABELS: Record<Category, string> = {
  'blue-chip': 'Blue Chip',
  'mid-cap': 'Mid Cap',
  'low-cap': 'Low Cap',
  'micro-cap': 'Micro Cap',
  stablecoin: 'Cash & Stablecoins',
  defi: 'DeFi'
};

const CATEGORY_COLORS: Record<Category, string> = {
  'blue-chip': '#3b82f6',
  'mid-cap': '#a855f7',
  'low-cap': '#22c55e',
  'micro-cap': '#f97316',
  stablecoin: '#14b8a6',
  defi: '#8b5cf6'
};

const CATEGORY_ACCENT_COLORS: Record<Category, string> = {
  'blue-chip': '#60a5fa',
  'mid-cap': '#c084fc',
  'low-cap': '#4ade80',
  'micro-cap': '#fb923c',
  stablecoin: '#2dd4bf',
  defi: '#a855f7'
};

const LADDER_COLORS: Record<Category, string> = {
  'blue-chip': '#38bdf8',
  'mid-cap': '#a855f7',
  'low-cap': '#22c55e',
  'micro-cap': '#f97316',
  stablecoin: '#14b8a6',
  defi: '#a855f7'
};

const LADDER_RING_COLORS: Record<Category, string> = {
  'blue-chip': 'rgba(56, 189, 248, 0.12)',
  'mid-cap': 'rgba(168, 85, 247, 0.12)',
  'low-cap': 'rgba(34, 197, 94, 0.12)',
  'micro-cap': 'rgba(249, 115, 22, 0.12)',
  stablecoin: 'rgba(20, 184, 166, 0.12)',
  defi: 'rgba(168, 85, 247, 0.12)'
};

const LADDER_BG_COLORS: Record<Category, string> = {
  'blue-chip': 'rgba(56, 189, 248, 0.08)',
  'mid-cap': 'rgba(168, 85, 247, 0.08)',
  'low-cap': 'rgba(34, 197, 94, 0.08)',
  'micro-cap': 'rgba(249, 115, 22, 0.08)',
  stablecoin: 'rgba(20, 184, 166, 0.08)',
  defi: 'rgba(168, 85, 247, 0.08)'
};

const LADDER_BORDER_COLORS: Record<Category, string> = {
  'blue-chip': 'rgba(56, 189, 248, 0.3)',
  'mid-cap': 'rgba(168, 85, 247, 0.3)',
  'low-cap': 'rgba(34, 197, 94, 0.3)',
  'micro-cap': 'rgba(249, 115, 22, 0.3)',
  stablecoin: 'rgba(20, 184, 166, 0.3)',
  defi: 'rgba(168, 85, 247, 0.3)'
};

const LADDER_CAPSULE_BG: Record<Category, string> = {
  'blue-chip': 'rgba(37, 99, 235, 0.16)',
  'mid-cap': 'rgba(147, 51, 234, 0.16)',
  'low-cap': 'rgba(22, 163, 74, 0.16)',
  'micro-cap': 'rgba(234, 88, 12, 0.16)',
  stablecoin: 'rgba(13, 148, 136, 0.16)',
  defi: 'rgba(147, 51, 234, 0.16)'
};

const LADDER_CAPSULE_BORDER: Record<Category, string> = {
  'blue-chip': 'rgba(37, 99, 235, 0.4)',
  'mid-cap': 'rgba(147, 51, 234, 0.4)',
  'low-cap': 'rgba(22, 163, 74, 0.4)',
  'micro-cap': 'rgba(234, 88, 12, 0.4)',
  stablecoin: 'rgba(13, 148, 136, 0.4)',
  defi: 'rgba(147, 51, 234, 0.4)'
};

const CATEGORY_GRADIENTS: Record<Category, string> = {
  'blue-chip': 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))',
  'mid-cap': 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.05))',
  'low-cap': 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))',
  'micro-cap': 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.05))',
  stablecoin: 'linear-gradient(135deg, rgba(20,184,166,0.2), rgba(20,184,166,0.05))',
  defi: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))'
};

const CATEGORY_BADGE_COLORS: Record<Category, string> = {
  'blue-chip': '#38bdf8',
  'mid-cap': '#a855f7',
  'low-cap': '#22c55e',
  'micro-cap': '#f97316',
  stablecoin: '#14b8a6',
  defi: '#8b5cf6'
};

interface ExitLadderRung {
  percent: number;
  multiplier: number;
  targetPrice: number;
  tokensToSell: number;
}

interface CompactHoldingsTableProps {
  groups: Record<Category, Holding[]>;
  prices: Record<string, ExtendedPriceQuote>;
  totals: any;
  expandedCategories: Set<Category>;
  onToggleCategory: (category: Category) => void;
  onEditHolding: (holding: Holding) => void;
  onRemoveHolding: (holding: Holding) => void;
  onToggleLock: (holding: Holding) => void;
  onAddAsset?: () => void;
  onAddToStablecoins?: () => void;
  selectedPreset: 'n4' | 'custom';
  selectedCategory: Category | 'all';
  displayedCategories: Category[];
  exitPlans: Record<string, ExitLadderRung[]>;
  cash: number;
  onUpdateCash: (amount: number) => void;
}

const categoryGradient = (category: Category) => CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS['blue-chip'];

const categoryAccentColor = (category: Category) => CATEGORY_ACCENT_COLORS[category] ?? CATEGORY_ACCENT_COLORS['blue-chip'];

const categoryColor = (category: Category) => CATEGORY_COLORS[category] ?? CATEGORY_COLORS['blue-chip'];

const ladderColor = (category: Category) => LADDER_COLORS[category] ?? LADDER_COLORS['blue-chip'];

const ladderRingColor = (category: Category) => LADDER_RING_COLORS[category] ?? LADDER_RING_COLORS['blue-chip'];

const ladderBgColor = (category: Category) => LADDER_BG_COLORS[category] ?? LADDER_BG_COLORS['blue-chip'];

const ladderBorderColor = (category: Category) => LADDER_BORDER_COLORS[category] ?? LADDER_BORDER_COLORS['blue-chip'];

const ladderCapsuleBg = (category: Category) => LADDER_CAPSULE_BG[category] ?? LADDER_CAPSULE_BG['blue-chip'];

const ladderCapsuleBorder = (category: Category) => LADDER_CAPSULE_BORDER[category] ?? LADDER_CAPSULE_BORDER['blue-chip'];

const categoryBadgeColor = (category: Category) => CATEGORY_BADGE_COLORS[category] ?? CATEGORY_BADGE_COLORS['blue-chip'];

function formatUsd(value: number, decimals = 2): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toFixed(decimals)}`;
}

function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  if (price >= 0.000001) return `$${price.toFixed(8)}`;
  return `$${price.toExponential(2)}`;
}

function formatTokens(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '0';
  }
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  if (amount >= 1) {
    return amount.toFixed(4).replace(/\.?0+$/, '');
  }
  if (amount >= 0.0001) {
    return amount.toFixed(6).replace(/\.?0+$/, '');
  }
  if (amount >= 0.000001) {
    return amount.toFixed(8).replace(/\.?0+$/, '');
  }
  return amount.toExponential(2);
}

const CompactHoldingsTable = memo(function CompactHoldingsTable({
  groups,
  prices,
  totals,
  expandedCategories,
  onToggleCategory,
  onEditHolding,
  onRemoveHolding,
  onToggleLock,
  onAddAsset,
  onAddToStablecoins,
  selectedPreset,
  selectedCategory,
  displayedCategories,
  exitPlans,
  cash,
  onUpdateCash
}: CompactHoldingsTableProps) {
  // Default hidden columns: only "Exit Ladder" and "Notes"
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    const prefs = loadUIPreferences();
    // If no preferences saved, default to hiding only ladder and notes
    return new Set(prefs.hiddenColumns.length > 0 ? prefs.hiddenColumns : ['ladder', 'notes']);
  });

  const [columnsOpen, setColumnsOpen] = useState(false);
  const [cashInput, setCashInput] = useState(cash.toString());
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [cashSaveStatus, setCashSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previousCash, setPreviousCash] = useState(cash);

  // Sync cash input when external cash changes
  useMemo(() => {
    if (!isEditingCash) {
      setCashInput(cash.toString());
      setPreviousCash(cash);
    }
  }, [cash, isEditingCash]);

  const handleCashSave = useCallback(() => {
    const newCash = parseFloat(cashInput);
    // Validate: disallow negative or invalid values
    if (isNaN(newCash) || newCash < 0 || cashInput.trim() === '') {
      // Revert to previous value
      setCashInput(previousCash.toString());
      setIsEditingCash(false);
      return;
    }
    
    // Only save if value changed
    if (newCash !== previousCash) {
      setCashSaveStatus('saving');
      onUpdateCash(newCash);
      setPreviousCash(newCash);
      
      // Show saved indicator briefly
      setTimeout(() => {
        setCashSaveStatus('saved');
        setTimeout(() => {
          setCashSaveStatus('idle');
        }, 1000);
      }, 200);
    }
    setIsEditingCash(false);
  }, [cashInput, previousCash, onUpdateCash]);

  const handleCashCancel = useCallback(() => {
    setCashInput(previousCash.toString());
    setIsEditingCash(false);
  }, [previousCash]);

  const handleCashKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCashSave();
    } else if (e.key === 'Escape') {
      handleCashCancel();
    }
  }, [handleCashSave, handleCashCancel]);

  const handleCashBlur = useCallback(() => {
    // Save on blur if changed
    handleCashSave();
  }, [handleCashSave]);

  const startCashEdit = useCallback(() => {
    setPreviousCash(cash);
    setIsEditingCash(true);
  }, [cash]);

  // Format currency with commas, no decimals unless user entered them
  const formatCashDisplay = (value: number): string => {
    if (Number.isInteger(value)) {
      return `$${value.toLocaleString()}`;
    }
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const categoryTotals = useMemo(() => {
    const result: Record<Category, { value: number; share: number }> = {} as any;
    for (const category of Object.keys(groups) as Category[]) {
      const holdings = groups[category] || [];
      let categoryValue = holdings.reduce((total, holding) => {
        const price = prices[holding.symbol]?.priceUsd ?? holding.avgCost ?? 0;
        return total + valueUsd(holding, price);
      }, 0);
      // Add cash to stablecoin category value
      if (category === 'stablecoin') {
        categoryValue += cash;
      }
      const totalValue = totals.totalValue || 0;
      const categoryShare = totalValue > 0 ? (categoryValue / totalValue) * 100 : 0;
      result[category] = { value: categoryValue, share: categoryShare };
    }
    // Ensure stablecoin category exists if there's cash, even with no holdings
    if (cash > 0 && !result['stablecoin']) {
      const totalValue = totals.totalValue || 0;
      result['stablecoin'] = { 
        value: cash, 
        share: totalValue > 0 ? (cash / totalValue) * 100 : 0 
      };
    }
    return result;
  }, [groups, prices, totals, cash]);

  const isColumnHidden = useCallback(
    (columnId: string) => hiddenColumns.has(columnId),
    [hiddenColumns]
  );

  const toggleColumn = useCallback(
    (columnId: string) => {
      setHiddenColumns(prev => {
        const next = new Set(prev);
        if (next.has(columnId)) {
          next.delete(columnId);
        } else {
          next.add(columnId);
        }
        saveUIPreferences({
          ...loadUIPreferences(),
          hiddenColumns: Array.from(next)
        });
        return next;
      });
    },
    []
  );

  const handleEditHolding = useCallback(
    (holding: Holding) => {
      onEditHolding(holding);
    },
    [onEditHolding]
  );

  const handleRemoveHolding = useCallback(
    (holding: Holding) => {
      onRemoveHolding(holding);
    },
    [onRemoveHolding]
  );

  const handleToggleLock = useCallback(
    (holding: Holding) => {
      onToggleLock(holding);
    },
    [onToggleLock]
  );

  const getCategoryExitPlan = useCallback(
    (category: Category): ExitLadderRung[] => {
      const key = `category:${category}:${selectedPreset}`;
      return exitPlans[key] || [];
    },
    [exitPlans, selectedPreset]
  );

  const getHoldingExitPlan = useCallback(
    (holding: Holding, category: Category): ExitLadderRung[] => {
      const baseKey = `holding:${holding.symbol}:${holding.id}`;
      const presetKey = `${baseKey}:${selectedPreset}`;
      const defaultCategoryKey = `category:${category}:${selectedPreset}`;
      return exitPlans[presetKey] || exitPlans[baseKey] || exitPlans[defaultCategoryKey] || [];
    },
    [exitPlans, selectedPreset]
  );

  const formatLadderSummary = (rungs: ExitLadderRung[]): string => {
    if (!rungs.length) return 'No ladder set';
    const avgMultiplier =
      rungs.reduce((sum, rung) => sum + rung.multiplier * (rung.percent / 100), 0) || 0;
    const totalPercent = rungs.reduce((sum, rung) => sum + rung.percent, 0);
    return `${Math.round(totalPercent)}% of position, weighted avg ${avgMultiplier.toFixed(2)}×`;
  };

  const renderExitLadderPill = (holding: Holding, category: Category) => {
    const rungs = getHoldingExitPlan(holding, category);
    const color = ladderColor(category);
    const ringColor = ladderRingColor(category);
    const bgColor = ladderBgColor(category);
    const borderColor = ladderBorderColor(category);
    const gradientId = `ladder-ring-${holding.id}`;

    return (
      <Popover>
        <PopoverTrigger>
          <button
            className="group flex items-center gap-3 rounded-full px-3 py-2 text-xs font-medium transition-smooth"
            style={{
              background: bgColor,
              border: `1px solid ${borderColor}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            }}
            type="button"
          >
            <span className="relative flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 32 32" className="transition-transform group-hover:scale-105">
                <defs>
                  <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                    <stop offset="65%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="16" cy="16" r="11" fill={ringColor} />
                <circle cx="16" cy="16" r="10" fill="transparent" stroke={color} strokeWidth="1.2" />
                <circle
                  cx="16"
                  cy="16"
                  r="6"
                  fill={`url(#${gradientId})`}
                  stroke={color}
                  strokeWidth="0.6"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.5))' }}
                />
              </svg>
              <Target className="absolute inset-0 m-auto h-4 w-4 text-white/80 opacity-70" />
            </span>
            <span className="flex flex-col items-start">
              <span className="text-[11px] font-semibold tracking-wide text-primary-foreground/90">
                Exit Ladder
              </span>
              <span className="text-[10px] text-primary-foreground/60">
                {formatLadderSummary(rungs)}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] glass-panel border-divide/50 backdrop-blur-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: ladderCapsuleBg(category), border: `1px solid ${ladderCapsuleBorder(category)}` }}
              >
                <Target className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground/80">
                  {holding.symbol} Exit Strategy
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatLadderSummary(rungs)}
                </div>
              </div>
            </div>
          </div>
          {rungs.length ? (
            <div className="space-y-2">
              {rungs.map((rung, idx) => (
                <div
                  key={idx}
                  className="glass-panel flex items-center justify-between rounded-lg border border-divide/60 px-3 py-2 text-xs hover:border-divide transition-smooth"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: ladderCapsuleBg(category),
                        border: `1px solid ${ladderCapsuleBorder(category)}`,
                        color
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground/90">
                        Sell {rung.percent.toFixed(0)}% at {rung.multiplier.toFixed(2)}×
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Target: {formatPrice(rung.targetPrice)} • Approx{' '}
                        {formatTokens(rung.tokensToSell)} {holding.symbol}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="border-none bg-emerald-500/10 text-[10px] text-emerald-400"
                    >
                      Locked-in
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-divide/60 bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground/80">
              No exit ladder defined yet for this position. Configure a strategy from the Exit
              Strategy tab to see the rungs here.
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  const renderLadderPreviewChip = (category: Category) => {
    const rungs = getCategoryExitPlan(category);
    const color = ladderColor(category);
    const ringColor = ladderRingColor(category);
    const bgColor = ladderBgColor(category);
    const borderColor = ladderBorderColor(category);
    const gradientId = `ladder-ring-category-${category}`;

    return (
      <Popover>
        <PopoverTrigger>
          <button
            className="group flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[10px] font-medium transition-smooth"
            style={{
              background: bgColor,
              border: `1px solid ${borderColor}`,
              boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
            }}
            type="button"
          >
            <span className="relative flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 32 32" className="transition-transform group-hover:scale-105">
                <defs>
                  <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                    <stop offset="65%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="16" cy="16" r="11" fill={ringColor} />
                <circle cx="16" cy="16" r="10" fill="transparent" stroke={color} strokeWidth="1.2" />
                <circle
                  cx="16"
                  cy="16"
                  r="6"
                  fill={`url(#${gradientId})`}
                  stroke={color}
                  strokeWidth="0.6"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.5))' }}
                />
              </svg>
              <Target className="absolute inset-0 m-auto h-3 w-3 text-white/80 opacity-70" />
            </span>
            <span className="flex flex-col items-start">
              <span className="text-[10px] font-semibold tracking-wide text-primary-foreground/90">
                N/4 Ladder
              </span>
              <span className="text-[9px] text-primary-foreground/60">
                {formatLadderSummary(rungs)}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] glass-panel border-divide/50 backdrop-blur-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={{ backgroundColor: ladderCapsuleBg(category), border: `1px solid ${ladderCapsuleBorder(category)}` }}
              >
                <Target className="h-3.5 w-3.5" style={{ color }} />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground/80">
                  {CATEGORY_LABELS[category]} Exit Ladder Preset
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatLadderSummary(rungs)}
                </div>
              </div>
            </div>
          </div>
          {rungs.length ? (
            <div className="space-y-2">
              {rungs.map((rung, idx) => (
                <div
                  key={idx}
                  className="glass-panel flex items-center justify-between rounded-lg border border-divide/60 px-3 py-2 text-xs hover:border-divide transition-smooth"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        backgroundColor: ladderCapsuleBg(category),
                        border: `1px solid ${ladderCapsuleBorder(category)}`,
                        color
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground/90">
                        Sell {rung.percent.toFixed(0)}% at {rung.multiplier.toFixed(2)}×
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Target: {formatPrice(rung.targetPrice)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="border-none bg-emerald-500/10 text-[10px] text-emerald-400"
                    >
                      Preset
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-divide/60 bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground/80">
              No default ladder defined yet for this category. Configure strategies in the Exit Strategy tab.
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  const renderCategoryHeader = (category: Category) => {
    const total = categoryTotals[category] || { value: 0, share: 0 };
    const isExpanded = expandedCategories.has(category);
    const color = categoryColor(category);
    const accentColor = categoryAccentColor(category);

    return (
      <div
        className="flex items-center justify-between rounded-xl px-4 py-2 mb-2 mx-2"
        style={{
          background: categoryGradient(category),
          border: `1px solid ${accentColor}33`
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleCategory(category)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/20 text-foreground/80 shadow-sm transition-smooth hover:bg-black/40"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground shadow-md"
            style={{ backgroundColor: color }}
          >
            {CATEGORY_LABELS[category].charAt(0)}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-foreground/90">
              {CATEGORY_LABELS[category]}
            </span>
            <Badge
              variant="outline"
              className="border-none bg-black/30 px-1.5 py-0 text-[10px] text-muted-foreground"
            >
              {groups[category]?.length ?? 0} positions
            </Badge>
            <span className="h-3 w-px bg-divide/40" />
            <span className="text-xs text-muted-foreground/80">
              Value <span className="font-medium text-foreground/90">{formatUsd(total.value)}</span>
            </span>
            <span className="h-3 w-px bg-divide/40" />
            <span className="text-xs text-muted-foreground/80">
              Share <span className="font-medium text-foreground/90">{formatPercent(total.share, 1)}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex h-6 w-6 items-center justify-center rounded-full border border-divide/80 bg-black/20 text-muted-foreground transition-smooth hover:bg-black/40">
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="glass-panel border-divide/60 text-[11px] leading-relaxed">
              Category totals are based on your current holdings and live prices. Exit ladder previews reflect the
              N/4 strategy configured for this category.
            </TooltipContent>
          </Tooltip>

          <Popover>
            <PopoverTrigger asChild>
              <button className="flex h-6 items-center gap-1 rounded-full border border-divide/80 bg-black/20 px-2 text-[10px] text-muted-foreground transition-smooth hover:bg-black/40">
                <Settings className="h-3 w-3" />
                <span>Settings</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 glass-panel border-divide/60 text-xs">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-primary-foreground shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {CATEGORY_LABELS[category].charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground/90">
                      {CATEGORY_LABELS[category]} Settings
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Configure how this category behaves in your exit strategy.
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground/90">
                    Risk weighting for N/4 exits
                  </Label>
                  <Slider
                    defaultValue={['60']}
                    min={20}
                    max={120}
                    step={5}
                    className="py-1"
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>More conservative</span>
                    <span>More aggressive</span>
                  </div>
                </div>
                <div className="rounded-lg border border-dashed border-divide/60 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                  Category-level settings will shape the default N/4 ladders for new positions added to this
                  bucket. You can still customize each ladder at the asset level.
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  };

  const renderHoldingRow = (holding: Holding, category: Category) => {
    const price = prices[holding.symbol]?.priceUsd ?? holding.avgCost ?? 0;
    const value = valueUsd(holding, price);
    const posShare = share(value, totals.totalValue);
    const percentChange = 0; // Not available in current ExtendedPriceQuote
    const isLocked = holding.categoryLocked ?? false;

    return (
      <div
        key={holding.id}
        className="grid grid-cols-[1.6fr_1.2fr_1.2fr_1.4fr_1.2fr_1.1fr_minmax(0,2.4fr)_auto] items-center gap-3 rounded-xl border border-divide/80 bg-gradient-to-br from-black/40 via-slate-900/60 to-black/30 px-3 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.55)] hover:border-divide/40 transition-smooth"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground shadow-md"
            style={{ backgroundColor: categoryColor(category) }}
          >
            {holding.symbol.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-semibold text-foreground">{holding.symbol}</span>
              {isLocked && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <Lock className="h-3 w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="glass-panel border-divide/60 text-[11px] leading-relaxed">
                    This position is locked. It will remain in place even if you rebalance other parts of the
                    portfolio.
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {!isColumnHidden('price') && (
          <div className="text-sm">
            <div className="font-mono text-foreground/90">{formatPrice(price)}</div>
            <div className="text-[11px] text-muted-foreground/80">
              Live price
            </div>
          </div>
        )}

        {!isColumnHidden('tokens') && (
          <div className="text-sm">
            <div className="font-mono text-foreground/90">{formatTokens(holding.tokensOwned)}</div>
            <div className="text-[11px] text-muted-foreground/80">Tokens</div>
          </div>
        )}

        {!isColumnHidden('value') && (
          <div className="text-sm">
            <div className="font-mono text-foreground/90">{formatUsd(value)}</div>
            <div className="text-[11px] text-muted-foreground/80">
              {formatPercent(posShare, 1)} of portfolio
            </div>
          </div>
        )}

        {!isColumnHidden('avgCost') && (
          <div className="text-sm">
            <div className="font-mono text-foreground/90">
              {holding.avgCost ? formatPrice(holding.avgCost) : '—'}
            </div>
            <div className="text-[11px] text-muted-foreground/80">
              {holding.avgCost ? 'Average cost' : 'Using live price'}
            </div>
          </div>
        )}

        {!isColumnHidden('%change') && (
          <div className="text-sm">
            <div
              className={cn(
                'font-mono',
                percentChange > 0 ? 'text-emerald-400' : percentChange < 0 ? 'text-rose-400' : 'text-muted-foreground'
              )}
            >
              {percentChange > 0 ? '+' : ''}
              {percentChange.toFixed(2)}%
            </div>
            <div className="text-[11px] text-muted-foreground/80">24h change</div>
          </div>
        )}

        {!isColumnHidden('ladder') && (
          <div className="flex items-center justify-start">
            {renderExitLadderPill(holding, category)}
          </div>
        )}

        {!isColumnHidden('notes') && (
          <div className="text-[11px] text-muted-foreground/90">
            {holding.notes ? holding.notes : 'No notes yet'}
          </div>
        )}

        {!isColumnHidden('actions') && (
          <div className="flex items-center justify-end gap-2">
            <Tooltip>
              <TooltipTrigger>
                <button
                  className={cn(
                    'h-7 w-7 rounded-full border border-divide/80 bg-black/20 text-muted-foreground transition-smooth hover:bg-black/40 hover:text-foreground',
                    isLocked && 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                  )}
                  onClick={() => handleToggleLock(holding)}
                  type="button"
                >
                  {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent className="glass-panel border-divide/60 text-[11px] leading-relaxed">
                {isLocked
                  ? 'Unlock this position so it can be adjusted when you rebalance.'
                  : 'Lock this position to keep it fixed while adjusting others.'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <button
                  className="h-7 w-7 rounded-full border border-divide/80 bg-black/20 text-muted-foreground transition-smooth hover:bg-black/40 hover:text-foreground"
                  onClick={() => handleEditHolding(holding)}
                  type="button"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="glass-panel border-divide/60 text-[11px]">
                Edit this position
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger>
                <button
                  className="h-7 w-7 rounded-full border border-rose-500/60 bg-rose-500/10 text-rose-300 transition-smooth hover:bg-rose-500/20 hover:text-rose-200"
                  onClick={() => handleRemoveHolding(holding)}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="glass-panel border-divide/60 text-[11px]">
                Remove this position
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    );
  };

  // Simplified row for stablecoin assets - only shows Symbol, Price, Tokens, Value, Actions
  const renderStablecoinRow = (holding: Holding) => {
    const price = prices[holding.symbol]?.priceUsd ?? holding.avgCost ?? 0;
    const value = valueUsd(holding, price);
    const posShare = share(value, totals.totalValue);
    const isLocked = holding.categoryLocked ?? false;

    return (
      <div
        key={holding.id}
        className="grid grid-cols-[2fr_1.2fr_1.2fr_1.4fr_auto] items-center gap-3 rounded-xl border border-divide/80 bg-gradient-to-br from-black/40 via-slate-900/60 to-black/30 px-3 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.55)] hover:border-divide/40 transition-smooth"
      >
        {/* Symbol */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground shadow-md"
            style={{ backgroundColor: categoryColor('stablecoin') }}
          >
            {holding.symbol.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-semibold text-foreground">{holding.symbol}</span>
              {isLocked && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Lock className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="text-sm">
          <div className="font-mono text-foreground/90">{formatPrice(price)}</div>
          <div className="text-[11px] text-muted-foreground/80">Live price</div>
        </div>

        {/* Tokens */}
        <div className="text-sm">
          <div className="font-mono text-foreground/90">{formatTokens(holding.tokensOwned)}</div>
          <div className="text-[11px] text-muted-foreground/80">Tokens</div>
        </div>

        {/* Value */}
        <div className="text-sm">
          <div className="font-mono text-foreground/90">{formatUsd(value)}</div>
          <div className="text-[11px] text-muted-foreground/80">
            {formatPercent(posShare, 1)} of portfolio
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Tooltip>
            <TooltipTrigger>
              <button
                className={cn(
                  'h-7 w-7 rounded-full border border-divide/80 bg-black/20 text-muted-foreground transition-smooth hover:bg-black/40 hover:text-foreground',
                  isLocked && 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                )}
                onClick={() => handleToggleLock(holding)}
                type="button"
              >
                {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="glass-panel border-divide/60 text-[11px] leading-relaxed">
              {isLocked ? 'Unlock this position' : 'Lock this position'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <button
                className="h-7 w-7 rounded-full border border-divide/80 bg-black/20 text-muted-foreground transition-smooth hover:bg-black/40 hover:text-foreground"
                onClick={() => handleEditHolding(holding)}
                type="button"
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="glass-panel border-divide/60 text-[11px]">
              Edit this position
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <button
                className="h-7 w-7 rounded-full border border-rose-500/60 bg-rose-500/10 text-rose-300 transition-smooth hover:bg-rose-500/20 hover:text-rose-200"
                onClick={() => handleRemoveHolding(holding)}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="glass-panel border-divide/60 text-[11px]">
              Remove this position
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  };

  const ColumnToggleMenu = () => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button
            className="gradient-outline-btn text-sm inline-flex items-center gap-2"
            style={{ transition: 'all 150ms ease-out' }}
            type="button"
          >
            <Settings className="h-4 w-4" />
            <span>Columns</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52 glass-panel border-divide/60 text-xs">
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Visible columns
          </div>
          {[
            { id: 'price', label: 'Price' },
            { id: 'tokens', label: 'Tokens' },
            { id: 'value', label: 'Value' },
            { id: 'share', label: 'Share' },
            { id: 'avgCost', label: 'Avg Cost' },
            { id: '%change', label: '% Change' },
            { id: 'ladder', label: 'Exit Ladder' },
            { id: 'notes', label: 'Notes' },
            { id: 'actions', label: 'Actions' }
          ].map(col => (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={!hiddenColumns.has(col.id)}
              onClick={() => toggleColumn(col.id)}
              className="cursor-pointer text-xs"
            >
              {col.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <Card className="glass-panel border-divide/80 shadow-[0_22px_60px_rgba(0,0,0,0.75)]">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Positions
          </span>
          <Badge
            variant="outline"
            className="border-none bg-black/30 px-1.5 py-0 text-[10px] text-muted-foreground"
          >
            {Object.values(groups).reduce((acc, arr) => acc + (arr?.length ?? 0), 0)} total
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-divide/80 bg-black/20 text-muted-foreground transition-smooth hover:bg-black/40 hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-80 glass-panel border-divide/60 text-xs"
            >
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Portfolio view
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                This table focuses on the essentials: symbol, price, size, value, and how each position fits into your
                bigger picture. Use the Columns menu to hide details you don&apos;t need right now.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Exit ladders are configured from the Exit Strategy tab and reflected here once set.
              </p>
            </PopoverContent>
          </Popover>

          {onAddAsset && (
            <button
              type="button"
              onClick={onAddAsset}
              className="flex h-7 items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-primary/60 px-3 text-[11px] font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-smooth hover:shadow-primary/50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Asset</span>
            </button>
          )}

          <ColumnToggleMenu />
        </div>
      </div>

      <div className="border-t border-divide/60" />

      <div className="px-3 py-2">
        <div className="space-y-4">
          {displayedCategories.map(category => {
            const holdings = groups[category] || [];
            // For stablecoin category, show even if no holdings (to display cash row)
            // For other categories, hide if no holdings
            if (!holdings.length && (category !== 'stablecoin' || cash <= 0)) return null;
            const isExpanded = expandedCategories.has(category);
            
            // Sort holdings by value (highest first)
            const sortedHoldings = [...holdings].sort((a, b) => {
              const priceA = prices[a.symbol]?.priceUsd ?? a.avgCost ?? 0;
              const priceB = prices[b.symbol]?.priceUsd ?? b.avgCost ?? 0;
              const valueA = valueUsd(a, priceA);
              const valueB = valueUsd(b, priceB);
              return valueB - valueA; // Descending order (highest first)
            });

            return (
              <div key={category}>
                {renderCategoryHeader(category)}
                {isExpanded && (
                  <div className="space-y-2">
                    {/* Column headers - different layout for stablecoin category */}
                    {category === 'stablecoin' ? (
                      /* Stablecoin column headers: Symbol, Price, Tokens, Value, Actions only */
                      sortedHoldings.length > 0 && (
                        <div className="flex items-center justify-between px-1 mt-2 mb-1">
                          <div className="grid w-full grid-cols-[2fr_1.2fr_1.2fr_1.4fr_auto] text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                            <span className="pl-10">Symbol</span>
                            <span>Price</span>
                            <span>Tokens</span>
                            <span>Value</span>
                            <span className="text-right pr-2">Actions</span>
                          </div>
                        </div>
                      )
                    ) : (
                      /* Standard column headers for other categories */
                      <div className="flex items-center justify-between px-1 mt-2 mb-1">
                        <div className="grid w-full grid-cols-[1.6fr_1.2fr_1.2fr_1.4fr_1.2fr_1.1fr_minmax(0,2.4fr)_auto] text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                          <span className="pl-10">Symbol</span>
                          {!isColumnHidden('price') && <span>Price</span>}
                          {!isColumnHidden('tokens') && <span>Tokens</span>}
                          {!isColumnHidden('value') && <span>Value</span>}
                          {!isColumnHidden('avgCost') && <span>Avg Cost</span>}
                          {!isColumnHidden('%change') && <span>24h</span>}
                          {!isColumnHidden('ladder') && <span>Exit Ladder</span>}
                          <span className="text-right">
                            {!isColumnHidden('actions') && <span>Actions</span>}
                          </span>
                        </div>
                      </div>
                    )}
                    {/* Cash Balance Row - Custom layout (NOT standard columns) */}
                    {category === 'stablecoin' && (
                      <div 
                        className="mx-1 flex items-center justify-between rounded-xl border border-teal-500/20 px-4 py-3"
                        style={{
                          background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.06) 0%, rgba(15, 118, 110, 0.04) 100%)',
                        }}
                      >
                        {/* Left: Icon + Label + Badge */}
                        <div className="flex items-center gap-3">
                          <div 
                            className="flex h-9 w-9 items-center justify-center rounded-full shadow-lg"
                            style={{
                              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                              boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)',
                            }}
                          >
                            <DollarSign className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground/90">Cash Balance</span>
                              <span 
                                className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                                style={{
                                  background: 'rgba(20, 184, 166, 0.15)',
                                  color: '#2dd4bf',
                                  border: '1px solid rgba(20, 184, 166, 0.25)',
                                }}
                              >
                                Manual
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/60">Dry powder • Stablecoins</span>
                          </div>
                        </div>

                        {/* Right: Editable Amount with inline edit */}
                        <div className="flex items-center gap-2">
                          {isEditingCash ? (
                            <div className="flex items-center">
                              <span className="text-lg font-semibold text-teal-400 mr-0.5">$</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={cashInput}
                                onChange={(e) => setCashInput(e.target.value)}
                                onKeyDown={handleCashKeyDown}
                                onBlur={handleCashBlur}
                                autoFocus
                                className="w-28 bg-transparent text-lg font-semibold text-teal-400 text-right outline-none border-b border-teal-400/50 focus:border-teal-400 transition-colors"
                                placeholder="0"
                              />
                            </div>
                          ) : (
                            <button
                              onClick={startCashEdit}
                              className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5 transition-colors cursor-text"
                            >
                              <span className="text-xl font-semibold" style={{ color: '#2dd4bf' }}>
                                {formatCashDisplay(cash)}
                              </span>
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                          
                          {/* Save status indicator */}
                          {cashSaveStatus === 'saving' && (
                            <Loader2 className="h-4 w-4 text-teal-400 animate-spin" />
                          )}
                          {cashSaveStatus === 'saved' && (
                            <div className="flex items-center gap-1 text-teal-400 animate-in fade-in duration-200">
                              <Check className="h-4 w-4" />
                              <span className="text-[10px] font-medium">Saved</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {sortedHoldings.map(holding => 
                      category === 'stablecoin' 
                        ? renderStablecoinRow(holding) 
                        : renderHoldingRow(holding, category)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
});

export { CompactHoldingsTable };