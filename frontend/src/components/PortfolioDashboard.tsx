import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { usePortfolioStore } from '@/lib/store';
import { CompactHoldingsTable } from './CompactHoldingsTable';
import { ExitPlanSummary } from './ExitPlanSummary';
import { type Category, type Holding, getCategoryForHolding, updateCash } from '@/lib/dataModel';
import { getPriceAggregator, type ExtendedPriceQuote } from '@/lib/priceService';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { AllocationDonutChart } from './AllocationDonutChart';
import { CategoryTrendCharts } from './CategoryTrendCharts';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp } from 'lucide-react';
import { UnifiedAssetModal } from './UnifiedAssetModal';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { loadExitPlans, type ExitPlanState } from '@/lib/exitPlanPersistence';

const aggregator = getPriceAggregator();

export const PortfolioDashboard = memo(function PortfolioDashboard() {
  const store = usePortfolioStore();
  const [prices, setPrices] = useState<Record<string, ExtendedPriceQuote>>({});
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
      // Note: lastPriceUpdate tracking can be added to store if needed
    } catch (err) {
      console.error('Failed to fetch prices', err);
    }
  }, [symbols]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30_000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const totals = useMemo(() => {
    const totalValue = store.holdings.reduce((sum, holding) => {
      const price = prices[holding.symbol.toUpperCase()]?.priceUsd ?? holding.avgCost ?? 0;
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
      const price = priceData?.priceUsd ?? holding.avgCost ?? 0;
      const marketCap = priceData?.marketCapUsd ?? 0;
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
      const marketCap = prices[holding.symbol.toUpperCase()]?.marketCapUsd ?? 0;
      const category = getCategoryForHolding(holding, marketCap);
      result[category].push(holding);
    }

    return result;
  }, [store.holdings, prices]);

  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(
    () => new Set(['blue-chip', 'mid-cap'])
  );

  const toggleCategory = (category: Category) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleAddAssetClick = () => {
    setPrefilledSymbol(undefined);
    setShowUnifiedModal(true);
  };

  const handleUnifiedSubmit = (holding: Holding) => {
    // Call addHolding with separate parameters as expected by the store
    store.addHolding(holding.symbol, holding.tokensOwned, {
      avgCost: holding.avgCost,
      purchaseDate: holding.purchaseDate,
      notes: holding.notes,
    });
    setShowUnifiedModal(false);
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

  // Load exit plans from persistence - for ExitPlanSummary (expects Record<string, ExitPlanState>)
  const exitPlanStates = useMemo(() => {
    const loaded = loadExitPlans();
    return loaded || {};
  }, []);

  // Convert exit plan states to ExitLadderRung[] format for CompactHoldingsTable
  // This provides the ladder rungs expected by the table component
  const exitPlans = useMemo(() => {
    const result: Record<string, { percent: number; multiplier: number }[]> = {};
    
    // For now, return empty - exit plans need proper conversion logic
    // The exit ladder rungs are computed differently in the Exit Strategy page
    return result;
  }, [exitPlanStates]);

  const showEmptyState = store.holdings.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Portfolio</h2>
          <p className="text-sm text-muted-foreground">
            A calm view of your holdings, with live prices and exit ladders woven in.
          </p>
        </div>
      </div>

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
              onUpdateCash={updateCash}
            />
          </div>

          <div className="space-y-4">
            {/* Allocation Overview - moved to top */}
            <Card className="glass-panel border-divide/80">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <div>
                    <div className="text-xs font-semibold text-foreground/90">Allocation overview</div>
                    <div className="text-[11px] text-muted-foreground">
                      See how your categories stack up over time.
                    </div>
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

                {/* CategoryTrendCharts hidden - shows incorrect/stale snapshot data 
                    TODO: Implement proper daily snapshot recording before re-enabling
                <CategoryTrendCharts snapshots={store.snapshots} />
                */}
              </div>
            </Card>

            <ExitPlanSummary
              holdings={store.holdings}
              prices={prices}
              exitPlans={exitPlanStates}
              selectedPreset={selectedPreset}
              onPresetChange={handlePresetChange}
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