import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { usePortfolioStore } from '@/lib/store';
import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { CompactHoldingsTable } from './CompactHoldingsTable';
import { NearestExits } from './NearestExits';
import { type Category, type Holding, getCategoryForHolding } from '@/lib/dataModel';
import { getPriceAggregator, type ExtendedPriceQuote } from '@/lib/priceService';
import { getMarketDataService } from '@/lib/marketDataService';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { AllocationDonutChart } from './AllocationDonutChart';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, PieChart } from 'lucide-react';
import { UnifiedAssetModal } from './UnifiedAssetModal';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  loadCategoryExpandState, 
  saveCategoryExpandState, 
  getDefaultExpandedCategories 
} from '@/lib/categoryExpandState';

const aggregator = getPriceAggregator();
const marketDataService = getMarketDataService();

export const PortfolioDashboard = memo(function PortfolioDashboard() {
  const { principal } = useInternetIdentity();
  const store = usePortfolioStore(principal);
  const [prices, setPrices] = useState<Record<string, ExtendedPriceQuote>>({});
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [selectedPreset, setSelectedPreset] = useState<'n4' | 'custom'>('n4');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState<string | undefined>(undefined);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [editTokens, setEditTokens] = useState('');
  const [editAvgCost, setEditAvgCost] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const { allocations: allocationData } = usePortfolioSnapshots();

  // Convert allocations array to Record<Category, number> for AllocationDonutChart
  const allocations = useMemo(() => {
    const result: Record<Category, number> = {
      'blue-chip': 0,
      'mid-cap': 0,
      'low-cap': 0,
      'micro-cap': 0,
      'stablecoin': 0,
      'defi': 0,
    };
    
    if (Array.isArray(allocationData)) {
      for (const item of allocationData) {
        if (item && item.category && typeof item.value === 'number') {
          result[item.category] = item.value;
        }
      }
    }
    
    return result;
  }, [allocationData]);

  const symbols = useMemo(
    () =>
      Array.from(
        new Set(
          store.holdings.map(h => h.symbol.toUpperCase())
        )
      ),
    [store.holdings]
  );

  const fetchPrices = useCallback(async () => {
    if (!symbols.length) return;
    try {
      const quotes = await aggregator.getPrice(symbols);
      const priceMap: Record<string, ExtendedPriceQuote> = {};
      for (const quote of quotes) {
        priceMap[quote.symbol.toUpperCase()] = quote;
      }
      setPrices(priceMap);
      
      // Update holdings with fresh market data (stale-while-revalidate persistence)
      marketDataService.refreshForSymbols(symbols);
    } catch (err) {
      console.error('Failed to fetch prices', err);
    }
  }, [symbols]);

  // Fetch logos for all symbols (only once when symbols change)
  // Uses stored CoinGecko IDs when available for more reliable logo resolution
  const fetchLogos = useCallback(async () => {
    if (!symbols.length) return;
    try {
      // Build symbol -> CoinGecko ID map from holdings that have stored IDs
      const symbolToIdMap: Record<string, string> = {};
      for (const holding of store.holdings) {
        const symbol = holding.symbol.toUpperCase();
        if (holding.coingeckoId) {
          symbolToIdMap[symbol] = holding.coingeckoId;
          console.log(`[PortfolioDashboard] Using stored CoinGecko ID for ${symbol}: ${holding.coingeckoId}`);
        }
      }
      
      // Fetch logos using CoinGecko IDs for holdings that have them
      const idsToFetch = Object.keys(symbolToIdMap);
      if (idsToFetch.length > 0) {
        const idBasedLogos = await aggregator.getLogosWithIds(symbolToIdMap);
        setLogos(prev => ({ ...prev, ...idBasedLogos }));
      }
      
      // For symbols without stored IDs, use the standard symbol-based lookup
      const symbolsWithoutIds = symbols.filter(s => !symbolToIdMap[s]);
      if (symbolsWithoutIds.length > 0) {
        console.log(`[PortfolioDashboard] Fetching logos for symbols without stored IDs: ${symbolsWithoutIds.join(', ')}`);
        const symbolBasedLogos = await aggregator.getLogos(symbolsWithoutIds);
        setLogos(prev => ({ ...prev, ...symbolBasedLogos }));
      }
    } catch (err) {
      console.error('Failed to fetch logos', err);
    }
  }, [symbols, store.holdings]);

  useEffect(() => {
    fetchPrices();
    fetchLogos(); // Fetch logos on initial load
    const interval = setInterval(fetchPrices, 30_000);
    return () => clearInterval(interval);
  }, [fetchPrices, fetchLogos]);

  const totals = useMemo(() => {
    const totalValue = store.holdings.reduce((sum, holding) => {
      // Stale-while-revalidate: use live price > cached price > avg cost
      const price = prices[holding.symbol.toUpperCase()]?.priceUsd 
        ?? holding.lastPriceUsd 
        ?? holding.avgCost 
        ?? 0;
      return sum + holding.tokensOwned * price;
    }, 0) + store.cash; // Add cash to total

    const byCategory: Record<Category, number> = {
      'blue-chip': 0,
      'mid-cap': 0,
      'low-cap': 0,
      'micro-cap': 0,
      stablecoin: store.cash, // Initialize with cash amount
      defi: 0
    };

    for (const holding of store.holdings) {
      const priceData = prices[holding.symbol.toUpperCase()];
      // Stale-while-revalidate: use live price > cached price > avg cost
      const price = priceData?.priceUsd ?? holding.lastPriceUsd ?? holding.avgCost ?? 0;
      // Stale-while-revalidate for market cap: live > holding cache > -1 (UNKNOWN)
      // Use -1 as sentinel for "unknown" - getCategoryForHolding will use hysteresis/previous category
      const marketCap = priceData?.marketCapUsd ?? holding.lastMarketCapUsd ?? -1;
      const value = holding.tokensOwned * price;
      const category = getCategoryForHolding(holding, marketCap);
      byCategory[category] += value;
    }

    return { totalValue, byCategory };
  }, [store.holdings, prices, store.cash]);

  const groups = useMemo(() => {
    const result: Record<Category, Holding[]> = {
      'blue-chip': [],
      'mid-cap': [],
      'low-cap': [],
      'micro-cap': [],
      stablecoin: [],
      defi: []
    };

    for (const holding of store.holdings) {
      // Stale-while-revalidate for market cap: live > holding cache > -1 (UNKNOWN)
      // Use -1 as sentinel for "unknown" - getCategoryForHolding will use hysteresis/previous category
      const marketCap = prices[holding.symbol.toUpperCase()]?.marketCapUsd ?? holding.lastMarketCapUsd ?? -1;
      const category = getCategoryForHolding(holding, marketCap);
      result[category].push(holding);
    }

    return result;
  }, [store.holdings, prices]);

  // Category expand/collapse state with persistence
  // Load from localStorage on mount, save on change
  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(() => {
    // Load persisted state or use defaults (all expanded)
    const persisted = loadCategoryExpandState(principal ?? null);
    if (persisted) {
      return new Set(persisted.expandedCategories);
    }
    // First load: all categories expanded by default
    return new Set(getDefaultExpandedCategories());
  });

  // Re-load category state when principal changes (user logs in/out)
  useEffect(() => {
    const persisted = loadCategoryExpandState(principal ?? null);
    if (persisted) {
      setExpandedCategories(new Set(persisted.expandedCategories));
    } else {
      // First load for this user: all categories expanded
      setExpandedCategories(new Set(getDefaultExpandedCategories()));
    }
  }, [principal]);

  const toggleCategory = useCallback((category: Category) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      // Persist the new state
      saveCategoryExpandState(principal ?? null, Array.from(next));
      return next;
    });
  }, [principal]);

  const handleAddAssetClick = () => {
    setPrefilledSymbol(undefined);
    setShowUnifiedModal(true);
  };

  const handleUnifiedSubmit = (holding: Holding) => {
    // Call addHolding with all parameters including CoinGecko ID and logo
    store.addHolding(holding.symbol, holding.tokensOwned, {
      avgCost: holding.avgCost,
      purchaseDate: holding.purchaseDate,
      notes: holding.notes,
      coingeckoId: holding.coingeckoId,
      logoUrl: holding.logoUrl,
    });
    // Note: Do NOT close modal here - let UnifiedAssetModal control this
    // based on whether user clicked "Add Asset" vs "Add & Add Another"
  };

  const handleEditHoldingInit = (holding: Holding) => {
    setEditingHolding(holding);
    setEditTokens(holding.tokensOwned.toString());
    setEditAvgCost((holding.avgCost ?? '').toString());
    setEditNotes(holding.notes ?? '');
    setShowEditDialog(true);
  };

  const handleEditHolding = () => {
    if (!editingHolding) return;
    const tokensOwned = parseFloat(editTokens || '0');
    const avgCost = editAvgCost ? parseFloat(editAvgCost) : undefined;

    store.updateHolding(editingHolding.id, {
      tokensOwned,
      avgCost,
      notes: editNotes
    });

    setShowEditDialog(false);
    setEditingHolding(null);
  };

  const handleRemoveHolding = (holding: Holding) => {
    store.removeHolding(holding.id);
  };

  const handleToggleLock = (holding: Holding) => {
    store.updateHolding(holding.id, { locked: !(holding.locked ?? false) });
  };

  const handleUpdateNotes = (holdingId: string, notes: string) => {
    store.updateHolding(holdingId, { notes });
  };

  const displayedCategories = useMemo(() => {
    if (selectedCategory === 'all') {
      // Cash & Stablecoins at top, then by market cap descending
      return ['stablecoin', 'blue-chip', 'mid-cap', 'low-cap', 'micro-cap', 'defi'] as Category[];
    }
    return [selectedCategory];
  }, [selectedCategory]);

  const handleSliceClick = (category: Category) => {
    setSelectedCategory(category === selectedCategory ? 'all' : category);
  };

  const handlePresetChange = (preset: 'n4' | 'custom') => {
    setSelectedPreset(preset);
  };

  // Load raw exit plans from localStorage (ysl-exit-plans key) - for NearestExits component
  // This preserves the full structure with rungs array
  const exitPlanStates = useMemo(() => {
    try {
      const stored = localStorage.getItem('ysl-exit-plans');
      if (!stored) return {};
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load exit plan states:', error);
      return {};
    }
  }, []);

  // Convert exit plans to simplified ExitLadderRung[] format for CompactHoldingsTable
  // This extracts just the rungs array with valid entries
  const exitPlans = useMemo(() => {
    const result: Record<string, { percent: number; multiplier: number; targetPrice: number; tokensToSell: number }[]> = {};
    
    Object.entries(exitPlanStates).forEach(([holdingId, plan]: [string, any]) => {
      if (plan && Array.isArray(plan.rungs)) {
        // Filter out invalid rungs (multiplier 0, targetPrice 0)
        const validRungs = plan.rungs.filter((r: any) => 
          r.multiplier > 0 && r.targetPrice > 0 && r.tokensToSell > 0
        );
        if (validRungs.length > 0) {
          result[holdingId] = validRungs;
        }
      }
    });
    
    return result;
  }, [exitPlanStates]);

  // Show table even when empty - category shells always visible
  const showEmptyState = false; // Always show the table structure

  // Format total value for display
  const formattedTotalValue = useMemo(() => {
    return totals.totalValue.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [totals.totalValue]);

  return (
    <div className="space-y-4">
      {/* Header removed per requirement - nav tab already indicates location */}

      {showEmptyState ? (
        <Card className="glass-panel border-divide/80 py-10 shadow-[0_22px_60px_rgba(0,0,0,0.8)]">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary shadow-inner shadow-primary/40">
              <TrendingUp className="h-7 w-7" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-foreground">Add your first positions</h3>
            <p className="mb-5 text-sm text-muted-foreground">
              Start by adding the BTC, ETH, ICP, or other positions you already hold. The tracker will pull live
              prices and show your allocation at a glance.
            </p>
            <Button
              size="sm"
              className="rounded-full bg-gradient-to-r from-primary to-primary/60 px-4 text-xs font-medium shadow-lg shadow-primary/30 transition-smooth hover:shadow-primary/50"
              onClick={handleAddAssetClick}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add your first asset
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3.5fr)_minmax(0,1.8fr)]">
          <div className="space-y-4">
            <CompactHoldingsTable
              groups={groups}
              prices={prices}
              logos={logos}
              totals={totals}
              expandedCategories={expandedCategories}
              onToggleCategory={toggleCategory}
              onEditHolding={handleEditHoldingInit}
              onRemoveHolding={handleRemoveHolding}
              onToggleLock={handleToggleLock}
              onAddAsset={handleAddAssetClick}
              selectedPreset={selectedPreset}
              selectedCategory={selectedCategory}
              displayedCategories={displayedCategories}
              exitPlans={exitPlans}
              cash={store.cash}
              onUpdateCash={store.setCash}
              cashNotes={store.cashNotes}
              onUpdateCashNotes={store.setCashNotes}
              onUpdateNotes={handleUpdateNotes}
            />
          </div>

          <div className="space-y-4">
            {/* Allocation Overview with Total Value prominently displayed */}
            <Card className="glass-panel border-divide/80 !p-0">
              {/* Total Value Header */}
              <div className="px-4 pt-3 pb-1.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div 
                      className="inline-block rounded-lg px-3 py-1 -mx-3 -my-1"
                      style={{ 
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px rgba(139, 92, 246, 0.15)'
                      }}
                    >
                      <span 
                        className="text-4xl font-bold tracking-tight text-foreground"
                        style={{ 
                          textShadow: '0 0 8px rgba(139, 92, 246, 0.6), 0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(99, 102, 241, 0.25)'
                        }}
                      >
                        {formattedTotalValue}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Total value
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground/60">
                    <PieChart className="h-4 w-4" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Allocation</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-divide/60" />
              <div className="space-y-3 px-4 py-3">
                <AllocationDonutChart
                  allocations={totals.byCategory}
                  onSliceClick={handleSliceClick}
                  selectedCategory={selectedCategory}
                  cashValue={store.cash}
                  stablecoinsOnlyValue={totals.byCategory['stablecoin'] - store.cash}
                />
              </div>
            </Card>

            <NearestExits
              holdings={store.holdings}
              prices={prices}
              exitPlans={exitPlanStates}
            />
          </div>
        </div>
      )}

      {/* Unified Asset Modal */}
      {showUnifiedModal && (
        <UnifiedAssetModal
          open={true}
          onOpenChange={setShowUnifiedModal}
          onSubmit={handleUnifiedSubmit}
          prefilledSymbol={prefilledSymbol}
        />
      )}

      {/* Edit Dialog */}
      {showEditDialog && editingHolding && (
        <Dialog open={true} onOpenChange={setShowEditDialog}>
          <DialogContent className="glass-panel border-divide/50 shadow-[0_4px_24px_rgba(0,0,0,0.3)] transition-smooth">
            <DialogHeader>
              <DialogTitle>Edit Holding</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-tokens">Tokens</Label>
                <Input
                  id="edit-tokens"
                  type="number"
                  value={editTokens}
                  onChange={(e) => setEditTokens(e.target.value)}
                  placeholder="Amount of tokens"
                  className="transition-smooth"
                />
              </div>
              <div>
                <Label htmlFor="edit-avgCost">Average Cost (USD)</Label>
                <Input
                  id="edit-avgCost"
                  type="number"
                  value={editAvgCost}
                  onChange={(e) => setEditAvgCost(e.target.value)}
                  placeholder="Average cost per token"
                  className="transition-smooth"
                />
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="transition-smooth"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                className="transition-smooth"
              >
                Cancel
              </Button>
            <Button onClick={handleEditHolding} className="gradient-accent border-0 transition-smooth">
              Save Changes
            </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
});
