import { useState, useMemo, useCallback, memo, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, ChevronRight, Edit, Trash2, Info, Target, Plus, Pencil, Check, Loader2, DollarSign } from 'lucide-react';
import { type Holding, type Category, valueUsd, share } from '@/lib/dataModel';
import { type ExtendedPriceQuote } from '@/lib/priceService';
import { cn } from '@/lib/utils';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS as IMPORTED_LABELS,
  CATEGORY_ACCENT_COLORS,
  CATEGORY_GRADIENTS,
  CATEGORY_BG_COLORS,
  CATEGORY_BORDER_COLORS,
  CATEGORY_RING_COLORS,
} from '@/lib/categoryColors';

// Override stablecoin label for this component
const CATEGORY_LABELS: Record<Category, string> = {
  ...IMPORTED_LABELS,
  stablecoin: 'Cash & Stablecoins',
} as Record<Category, string>;

// Ladder-specific colors (derived from primary colors)
const LADDER_COLORS: Record<Category, string> = {
  'blue-chip': '#60a5fa',   // Blue-400
  'mid-cap': '#c084fc',     // Purple-400
  'low-cap': '#fcd34d',     // Yellow-300
  'micro-cap': '#fb923c',   // Orange-400
  stablecoin: '#2dd4bf',    // Teal-400
  defi: '#a78bfa',          // Violet-400
};

const LADDER_RING_COLORS: Record<Category, string> = CATEGORY_RING_COLORS as Record<Category, string>;
const LADDER_BG_COLORS: Record<Category, string> = CATEGORY_BG_COLORS as Record<Category, string>;
const LADDER_BORDER_COLORS: Record<Category, string> = CATEGORY_BORDER_COLORS as Record<Category, string>;

const LADDER_CAPSULE_BG: Record<Category, string> = {
  'blue-chip': 'rgba(59, 130, 246, 0.16)',
  'mid-cap': 'rgba(168, 85, 247, 0.16)',
  'low-cap': 'rgba(234, 179, 8, 0.16)',
  'micro-cap': 'rgba(249, 115, 22, 0.16)',
  stablecoin: 'rgba(20, 184, 166, 0.16)',
  defi: 'rgba(139, 92, 246, 0.16)'
};

const LADDER_CAPSULE_BORDER: Record<Category, string> = {
  'blue-chip': 'rgba(59, 130, 246, 0.4)',
  'mid-cap': 'rgba(168, 85, 247, 0.4)',
  'low-cap': 'rgba(234, 179, 8, 0.4)',
  'micro-cap': 'rgba(249, 115, 22, 0.4)',
  stablecoin: 'rgba(20, 184, 166, 0.4)',
  defi: 'rgba(139, 92, 246, 0.4)'
};

const CATEGORY_BADGE_COLORS: Record<Category, string> = CATEGORY_ACCENT_COLORS as Record<Category, string>;

interface ExitLadderRung {
  percent: number;
  multiplier: number;
  targetPrice: number;
  tokensToSell: number;
}

interface CompactHoldingsTableProps {
  groups: Record<Category, Holding[]>;
  prices: Record<string, ExtendedPriceQuote>;
  logos: Record<string, string>;  // symbol -> logo URL
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
  cashNotes: string;
  onUpdateCashNotes: (notes: string) => void;
  onUpdateNotes?: (holdingId: string, notes: string) => void;
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
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return '0.0%';
  }
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
  logos,
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
  onUpdateCash,
  cashNotes,
  onUpdateCashNotes,
  onUpdateNotes
}: CompactHoldingsTableProps) {
  // Show ALL columns by default for now - no column toggling UI
  // Per requirement: "All columns should be visible by default"
  const hiddenColumns = useMemo(() => new Set<string>(), []);
  const [cashInput, setCashInput] = useState(cash.toString());
  
  // Inline notes editing state
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesInputValue, setNotesInputValue] = useState('');
  const notesInputRef = useRef<HTMLInputElement>(null);
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [cashSaveStatus, setCashSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previousCash, setPreviousCash] = useState(cash);
  
  // Cash notes editing state
  const [isEditingCashNotes, setIsEditingCashNotes] = useState(false);
  const [cashNotesInput, setCashNotesInput] = useState(cashNotes || '');
  const cashNotesInputRef = useRef<HTMLInputElement>(null);

  // Sync cash input when external cash changes
  useMemo(() => {
    if (!isEditingCash) {
      setCashInput(cash.toString());
      setPreviousCash(cash);
    }
  }, [cash, isEditingCash]);

  // Sync cash notes when external cashNotes changes
  useMemo(() => {
    if (!isEditingCashNotes) {
      setCashNotesInput(cashNotes || '');
    }
  }, [cashNotes, isEditingCashNotes]);

  const handleCashSave = useCallback(() => {
    const newCash = parseFloat(cashInput);
    if (isNaN(newCash) || newCash < 0 || cashInput.trim() === '') {
      setCashInput(previousCash.toString());
      setIsEditingCash(false);
      return;
    }
    
    if (newCash !== previousCash) {
      setCashSaveStatus('saving');
      onUpdateCash(newCash);
      setPreviousCash(newCash);
      
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
    handleCashSave();
  }, [handleCashSave]);

  const startCashEdit = useCallback(() => {
    setPreviousCash(cash);
    setIsEditingCash(true);
  }, [cash]);

  const formatCashDisplay = (value: number): string => {
    if (Number.isInteger(value)) {
      return `$${value.toLocaleString()}`;
    }
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate cash share of portfolio
  const cashShare = useMemo(() => {
    const totalValue = totals.totalValue || 0;
    if (totalValue === 0) return 0;
    return (cash / totalValue) * 100;
  }, [cash, totals.totalValue]);

  // Cash notes editing handlers
  const startCashNotesEdit = useCallback(() => {
    setIsEditingCashNotes(true);
    setCashNotesInput(cashNotes || '');
    setTimeout(() => cashNotesInputRef.current?.focus(), 0);
  }, [cashNotes]);

  const saveCashNotes = useCallback(() => {
    onUpdateCashNotes(cashNotesInput);
    setIsEditingCashNotes(false);
  }, [cashNotesInput, onUpdateCashNotes]);

  const cancelCashNotesEdit = useCallback(() => {
    setCashNotesInput(cashNotes || '');
    setIsEditingCashNotes(false);
  }, [cashNotes]);

  const handleCashNotesKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveCashNotes();
    } else if (e.key === 'Escape') {
      cancelCashNotesEdit();
    }
  }, [saveCashNotes, cancelCashNotesEdit]);

  const handleCashNotesBlur = useCallback(() => {
    saveCashNotes();
  }, [saveCashNotes]);

  // Notes inline editing handlers
  const startNotesEdit = useCallback((holding: Holding) => {
    setEditingNotesId(holding.id);
    setNotesInputValue(holding.notes || '');
    // Focus the input on next render
    setTimeout(() => notesInputRef.current?.focus(), 0);
  }, []);

  const saveNotes = useCallback((holdingId: string) => {
    if (onUpdateNotes) {
      onUpdateNotes(holdingId, notesInputValue);
    }
    setEditingNotesId(null);
  }, [notesInputValue, onUpdateNotes]);

  const cancelNotesEdit = useCallback(() => {
    setEditingNotesId(null);
    setNotesInputValue('');
  }, []);

  const handleNotesKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, holdingId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveNotes(holdingId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelNotesEdit();
    }
  }, [saveNotes, cancelNotesEdit]);

  const handleNotesBlur = useCallback((holdingId: string) => {
    saveNotes(holdingId);
  }, [saveNotes]);

  // Calculate stablecoins-only value (excluding cash)
  const stablecoinsOnlyValue = useMemo(() => {
    const holdings = groups['stablecoin'] || [];
    return holdings.reduce((total, holding) => {
      const price = prices[holding.symbol]?.priceUsd ?? holding.avgCost ?? 0;
      return total + valueUsd(holding, price);
    }, 0);
  }, [groups, prices]);

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

  // Column toggle function removed - all columns visible by default for now

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
      // Try direct holding ID first (used by PortfolioDashboard's exitPlans)
      if (exitPlans[holding.id]) {
        return exitPlans[holding.id];
      }
      // Fallback to legacy key formats
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

  // Format tokens without unnecessary trailing zeros
  const formatTokensCompact = (amount: number): string => {
    if (!Number.isFinite(amount) || amount === 0) return '0';
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    if (amount >= 100) return amount.toFixed(1).replace(/\.0$/, '');
    if (amount >= 1) return amount.toFixed(2).replace(/\.?0+$/, '');
    return amount.toFixed(4).replace(/\.?0+$/, '');
  };

  // Compact Exit Ladder display - shows next target and tokens to sell
  const renderExitLadderCompact = (holding: Holding, category: Category) => {
    const rungs = getHoldingExitPlan(holding, category);
    const currentPrice = prices[holding.symbol]?.priceUsd ?? 0;
    
    if (!rungs.length) {
      return (
        <div className="text-xs">
          <div className="text-muted-foreground/60">No plan</div>
        </div>
      );
    }

    // Find the next relevant rung (first rung with target price > current price, or just first rung)
    let nextRung = rungs[0];
    if (currentPrice > 0) {
      const futureRung = rungs.find(r => r.targetPrice > currentPrice && r.tokensToSell > 0);
      if (futureRung) nextRung = futureRung;
    }

    if (!nextRung || !nextRung.targetPrice) {
      return (
        <div className="text-xs">
          <div className="text-muted-foreground/60">No plan</div>
        </div>
      );
    }

    return (
      <div className="text-xs leading-tight">
        <div className="text-foreground/90 whitespace-nowrap">
          Next: {formatPrice(nextRung.targetPrice)}
        </div>
        <div className="text-muted-foreground/70 whitespace-nowrap">
          Sell:&nbsp;{formatTokensCompact(nextRung.tokensToSell)}&nbsp;{holding.symbol}
        </div>
      </div>
    );
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


  const renderCategoryHeader = (category: Category) => {
    const total = categoryTotals[category] || { value: 0, share: 0 };
    const isExpanded = expandedCategories.has(category);
    const color = categoryColor(category);
    const accentColor = categoryAccentColor(category);
    const holdingsCount = groups[category]?.length ?? 0;

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
              {holdingsCount} positions
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

        {/* Per-category controls removed per requirements */}
      </div>
    );
  };


  // Standard holding row for non-stablecoin categories - WITH lock removed, Edit/Delete only
  // Column order: Symbol | Value | Share | Price | Tokens | Avg Cost | 24H | Exit | Notes | Actions
  const renderHoldingRow = (holding: Holding, category: Category) => {
    const price = prices[holding.symbol]?.priceUsd ?? holding.avgCost ?? 0;
    const value = valueUsd(holding, price);
    const posShare = share(value, totals.totalValue);
    const percentChange = 0; // Not available in current ExtendedPriceQuote

    return (
      <div
        key={holding.id}
        className="group grid grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr_1fr_0.8fr_1.2fr_1.4fr_auto] items-center gap-2 rounded-xl border border-divide/80 bg-gradient-to-br from-black/40 via-slate-900/60 to-black/30 px-3 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.55)] hover:border-divide/40 transition-smooth"
      >
        {/* 1. Symbol */}
        <div className="flex items-center gap-3">
          {logos[holding.symbol] ? (
            <img
              src={logos[holding.symbol]}
              alt={holding.symbol}
              className="h-8 w-8 rounded-full object-contain shadow-md"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground shadow-md"
            style={{ 
              backgroundColor: categoryColor(category),
              display: logos[holding.symbol] ? 'none' : 'flex'
            }}
          >
            {holding.symbol.charAt(0).toUpperCase()}
          </div>
          <span className="text-base font-semibold text-foreground">{holding.symbol}</span>
        </div>

        {/* 2. Value */}
        <div className="text-sm">
          <div className="font-mono text-foreground/90">{formatUsd(value)}</div>
        </div>

        {/* 3. Share */}
        <div className="text-sm">
          <div className="font-mono text-foreground/80">{formatPercent(posShare, 1)}</div>
        </div>

        {/* 4. Price */}
        <div className="text-sm">
          <div className="font-mono text-foreground/90">{formatPrice(price)}</div>
        </div>

        {/* 5. Tokens */}
        <div className="text-sm">
          <div className="font-mono text-foreground/90">{formatTokens(holding.tokensOwned)}</div>
        </div>

        {/* 6. Avg Cost */}
        <div className="text-sm">
          <div className="font-mono text-foreground/90">
            {holding.avgCost ? formatPrice(holding.avgCost) : '—'}
          </div>
        </div>

        {/* 7. 24H % Change */}
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
        </div>

        {/* 8. Exit */}
        <div className="flex items-center justify-start">
          {renderExitLadderCompact(holding, category)}
        </div>

        {/* 9. Notes - inline editable */}
        <div 
          className="text-[11px] cursor-pointer rounded px-1 -mx-1 hover:bg-white/5"
          onClick={() => editingNotesId !== holding.id && startNotesEdit(holding)}
        >
          {editingNotesId === holding.id ? (
            <input
              ref={notesInputRef}
              type="text"
              value={notesInputValue}
              onChange={(e) => setNotesInputValue(e.target.value)}
              onKeyDown={(e) => handleNotesKeyDown(e, holding.id)}
              onBlur={() => handleNotesBlur(holding.id)}
              className="w-full bg-transparent text-foreground/90 outline-none border-b border-primary/50 focus:border-primary py-0.5"
              placeholder="Add note..."
            />
          ) : (
            <span className={holding.notes ? 'text-muted-foreground/90' : 'text-muted-foreground/50 italic'}>
              {holding.notes || 'No notes yet'}
            </span>
          )}
        </div>

        {/* 10. Actions - fixed utility column, always visible */}
        <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Edit button - compact icon */}
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-smooth hover:bg-white/5 hover:text-foreground"
            onClick={() => handleEditHolding(holding)}
            type="button"
            title="Edit holding"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>

          {/* Delete button - compact icon with red tint on hover */}
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-smooth hover:bg-rose-500/10 hover:text-rose-400"
            onClick={() => handleRemoveHolding(holding)}
            type="button"
            title="Delete holding"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };


  // Stablecoin row - uses same column order as regular assets
  // Column order: Symbol | Value | Share | Price | Tokens | Avg Cost | 24H | Exit | Notes | Actions
  const renderStablecoinRow = (holding: Holding) => {
    const price = prices[holding.symbol]?.priceUsd ?? holding.avgCost ?? 1;
    const value = valueUsd(holding, price);
    const posShare = share(value, totals.totalValue);

    return (
      <div
        key={holding.id}
        className="group grid grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr_1fr_0.8fr_1.2fr_1.4fr_auto] items-center gap-2 rounded-xl border border-divide/80 bg-gradient-to-br from-black/40 via-slate-900/60 to-black/30 px-3 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.55)] hover:border-divide/40 transition-smooth"
      >
        {/* 1. Symbol */}
        <div className="flex items-center gap-3">
          {logos[holding.symbol] ? (
            <img
              src={logos[holding.symbol]}
              alt={holding.symbol}
              className="h-8 w-8 rounded-full object-contain shadow-md"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground shadow-md"
            style={{ 
              backgroundColor: categoryColor('stablecoin'),
              display: logos[holding.symbol] ? 'none' : 'flex'
            }}
          >
            {holding.symbol.charAt(0).toUpperCase()}
          </div>
          <span className="text-base font-semibold text-foreground">{holding.symbol}</span>
        </div>

        {/* 2. Value */}
        <div className="text-sm">
          <div className="font-mono text-foreground/90">{formatUsd(value)}</div>
        </div>

        {/* 3. Share */}
        <div className="text-sm">
          <div className="font-mono text-foreground/80">{formatPercent(posShare, 1)}</div>
        </div>

        {/* 4. Price */}
        <div className="text-sm">
          <div className="font-mono text-foreground/90">{formatPrice(price)}</div>
        </div>

        {/* 5. Tokens */}
        <div className="text-sm">
          <div className="font-mono text-foreground/90">{formatTokens(holding.tokensOwned)}</div>
        </div>

        {/* 6. Avg Cost - dash for stablecoins */}
        <div className="text-sm">
          <div className="font-mono text-muted-foreground">—</div>
        </div>

        {/* 7. 24h Change - dash for stablecoins */}
        <div className="text-sm">
          <div className="font-mono text-muted-foreground">—</div>
        </div>

        {/* 8. Exit - No plan for stablecoins */}
        <div className="text-xs">
          <div className="text-muted-foreground/60">No plan</div>
        </div>

        {/* 9. Notes - inline editable */}
        <div 
          className="text-[11px] cursor-pointer rounded px-1 -mx-1 hover:bg-white/5"
          onClick={() => editingNotesId !== holding.id && startNotesEdit(holding)}
        >
          {editingNotesId === holding.id ? (
            <input
              ref={notesInputRef}
              type="text"
              value={notesInputValue}
              onChange={(e) => setNotesInputValue(e.target.value)}
              onKeyDown={(e) => handleNotesKeyDown(e, holding.id)}
              onBlur={() => handleNotesBlur(holding.id)}
              className="w-full bg-transparent text-foreground/90 outline-none border-b border-primary/50 focus:border-primary py-0.5"
              placeholder="Add note..."
            />
          ) : (
            <span className={holding.notes ? 'text-muted-foreground/90' : 'text-muted-foreground/50 italic'}>
              {holding.notes || 'No notes yet'}
            </span>
          )}
        </div>

        {/* Actions - fixed utility column, always visible (not toggleable) */}
        <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-smooth hover:bg-white/5 hover:text-foreground"
            onClick={() => handleEditHolding(holding)}
            type="button"
            title="Edit holding"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>

          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-smooth hover:bg-rose-500/10 hover:text-rose-400"
            onClick={() => handleRemoveHolding(holding)}
            type="button"
            title="Delete holding"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };


  // Cash Balance Row - uses same column order as regular assets
  // Column order: Symbol | Value | Share | Price | Tokens | Avg Cost | 24H | Exit | Notes | Actions
  const renderCashBalanceRow = () => {
    const cashShareValue = cashShare;

    return (
      <div 
        className="grid grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr_1fr_0.8fr_1.2fr_1.4fr_auto] items-center gap-2 rounded-lg border border-teal-500/20 px-3 py-2"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.06) 0%, rgba(15, 118, 110, 0.02) 100%)',
        }}
      >
        {/* 1. Symbol - Cash Balance label with icon */}
        <div className="flex items-center gap-3">
          <div 
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full shadow-md"
            style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
              boxShadow: '0 2px 8px rgba(20, 184, 166, 0.25)',
            }}
          >
            <DollarSign className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground/90 whitespace-nowrap">Cash Balance</span>
              <span 
                className="rounded-full px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider whitespace-nowrap"
                style={{
                  background: 'rgba(20, 184, 166, 0.15)',
                  color: '#2dd4bf',
                  border: '1px solid rgba(20, 184, 166, 0.25)',
                }}
              >
                Manual
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/50">Dry powder</span>
          </div>
        </div>

        {/* 2. Value - editable inline */}
        <div className="flex items-center gap-1">
          {isEditingCash ? (
            <div className="flex items-center">
              <span className="text-lg font-bold text-emerald-400 mr-0.5">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                onKeyDown={handleCashKeyDown}
                onBlur={handleCashBlur}
                autoFocus
                className="w-20 bg-transparent text-lg font-bold text-emerald-400 outline-none border-b-2 border-emerald-400/50 focus:border-emerald-400 transition-colors"
                placeholder="0"
              />
              {cashSaveStatus === 'saving' && (
                <Loader2 className="ml-1 h-4 w-4 text-emerald-400 animate-spin" />
              )}
              {cashSaveStatus === 'saved' && (
                <Check className="ml-1 h-4 w-4 text-emerald-400" />
              )}
            </div>
          ) : (
            <button
              onClick={startCashEdit}
              className="group flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-white/5 transition-colors cursor-text"
            >
              <span className="text-lg font-bold text-emerald-400 group-hover:underline group-hover:decoration-emerald-400/40 group-hover:underline-offset-2 transition-all">
                {formatCashDisplay(cash)}
              </span>
              <Pencil className="h-3 w-3 text-emerald-400/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* 3. Share */}
        <div className="text-sm">
          <span className="font-mono text-foreground/80">{formatPercent(cashShareValue, 1)}</span>
        </div>

        {/* 4. Price - empty for cash */}
        <div></div>

        {/* 5. Tokens - empty for cash */}
        <div></div>

        {/* 6. Avg Cost - empty for cash */}
        <div></div>

        {/* 7. 24H - empty for cash */}
        <div></div>

        {/* 8. Exit - empty for cash */}
        <div></div>

        {/* 9. Notes - Cash supports inline notes editing */}
        <div 
          className="text-[11px] cursor-pointer rounded px-1 -mx-1 hover:bg-white/5"
          onClick={() => !isEditingCashNotes && startCashNotesEdit()}
        >
          {isEditingCashNotes ? (
            <input
              ref={cashNotesInputRef}
              type="text"
              value={cashNotesInput}
              onChange={(e) => setCashNotesInput(e.target.value)}
              onKeyDown={handleCashNotesKeyDown}
              onBlur={handleCashNotesBlur}
              className="w-full bg-transparent text-foreground/90 outline-none border-b border-primary/50 focus:border-primary py-0.5"
              placeholder="Add note..."
            />
          ) : (
            <span className={cashNotes ? 'text-muted-foreground/90' : 'text-muted-foreground/50 italic'}>
              {cashNotes || 'No notes yet'}
            </span>
          )}
        </div>

        {/* 10. Actions - empty for Cash row */}
        <div></div>
      </div>
    );
  };

  // ColumnToggleMenu removed - all columns visible by default for now

  const totalPositions = Object.values(groups).reduce((acc, arr) => acc + (arr?.length ?? 0), 0);

  return (
    <Card className="glass-panel border-divide/80 shadow-[0_22px_60px_rgba(0,0,0,0.75)] !p-0">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left side: POSITIONS label + count badge + info icon */}
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-bold uppercase tracking-[0.10em] text-foreground">
            Positions
          </span>
          <Badge
            variant="outline"
            className="border-none bg-black/40 px-2 py-0.5 text-[11px] font-medium text-foreground/80"
          >
            {totalPositions} {totalPositions === 1 ? 'position' : 'positions'}
          </Badge>
          {/* Info tooltip - positioned after count badge, applies to Positions section */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-full border border-divide/80 bg-black/20 text-muted-foreground transition-smooth hover:bg-black/40 hover:text-foreground"
              >
                <Info className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-80 glass-panel border-divide/60 text-xs"
            >
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                How this table works
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                This table shows your portfolio positions grouped by category (Blue Chip, Mid Cap, Low Cap, etc.) based on market cap. Positions are sorted by value within each category.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Exit ladders are configured from the Exit Strategy tab and reflected here once set.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Right side: Add Asset button */}
        <div className="flex items-center">
          {onAddAsset && (
            <button
              type="button"
              onClick={onAddAsset}
              className="flex h-8 items-center gap-1.5 rounded-full bg-[#6366f1] px-4 text-sm font-medium text-white transition-all hover:bg-[#5558e3] active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Asset</span>
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-divide/60" />

      <div className="px-4 py-3">
        <div className="space-y-4">
          {displayedCategories.map(category => {
            const holdings = groups[category] || [];
            // Always show category shells, not just for stablecoin
            // This ensures consistent UI even for empty portfolios
            const isExpanded = expandedCategories.has(category);
            
            // Sort holdings by value (highest first)
            const sortedHoldings = [...holdings].sort((a, b) => {
              const priceA = prices[a.symbol]?.priceUsd ?? a.avgCost ?? 0;
              const priceB = prices[b.symbol]?.priceUsd ?? b.avgCost ?? 0;
              const valueA = valueUsd(a, priceA);
              const valueB = valueUsd(b, priceB);
              return valueB - valueA;
            });

            // Check if this is Cash & Stablecoins category
            const isCashCategory = category === 'stablecoin';
            const hasStablecoinAssets = sortedHoldings.length > 0;

            return (
              <div key={category}>
                {renderCategoryHeader(category)}
                {isExpanded && (
                  <div className="space-y-2">
                    {/* For Cash & Stablecoins: always render cash row first */}
                    {isCashCategory && renderCashBalanceRow()}
                    
                    {/* Column headers: only show if there are stablecoin assets (below cash row) */}
                    {isCashCategory && hasStablecoinAssets && (
                      <div className="flex items-center justify-between px-1 mt-3 mb-1">
                        <div className="grid w-full grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr_1fr_0.8fr_1.2fr_1.4fr_auto] gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                          <span className="pl-10">Symbol</span>
                          <span>Value</span>
                          <span>Share</span>
                          <span>Price</span>
                          <span>Tokens</span>
                          <span>Avg Cost</span>
                          <span>24h</span>
                          <span>Exit</span>
                          <span>Notes</span>
                          {/* Actions column - no header label */}
                          <span></span>
                        </div>
                      </div>
                    )}
                    
                    {/* For non-stablecoin categories: show headers only if there are holdings */}
                    {!isCashCategory && sortedHoldings.length > 0 && (
                      <div className="flex items-center justify-between px-1 mt-2 mb-1">
                        <div className="grid w-full grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr_1fr_0.8fr_1.2fr_1.4fr_auto] gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                          <span className="pl-10">Symbol</span>
                          <span>Value</span>
                          <span>Share</span>
                          <span>Price</span>
                          <span>Tokens</span>
                          <span>Avg Cost</span>
                          <span>24h</span>
                          <span>Exit</span>
                          <span>Notes</span>
                          {/* Actions column - no header label */}
                          <span></span>
                        </div>
                      </div>
                    )}
                    
                    {/* For empty non-stablecoin categories, show a subtle hint */}
                    {!isCashCategory && sortedHoldings.length === 0 && (
                      <div className="px-4 py-3 text-center text-xs text-muted-foreground/50 italic">
                        No {CATEGORY_LABELS[category].toLowerCase()} positions yet
                      </div>
                    )}
                    
                    {/* Render asset rows */}
                    {sortedHoldings.map(holding => 
                      isCashCategory 
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
