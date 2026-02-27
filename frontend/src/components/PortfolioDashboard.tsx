import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePortfolioStore } from '@/lib/store';
import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { useActor } from '@/hooks/useActor';
import { CompactHoldingsTable } from './CompactHoldingsTable';
import { NearestExits } from './NearestExits';
import { type Category, type Holding, getCategoryForHolding } from '@/lib/dataModel';
import { getPriceAggregator, type ExtendedPriceQuote } from '@/lib/priceService';
import { getMarketDataService } from '@/lib/marketDataService';
import { usePortfolioSnapshots } from '@/hooks/usePortfolioSnapshots';
import { AllocationDonutChart } from './AllocationDonutChart';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { UnifiedAssetModal } from './UnifiedAssetModal';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { GainLossPill } from '@/components/ui/gain-loss-pill';
import { DataFreshness } from '@/components/ui/data-freshness';
import { DashboardSkeleton } from '@/components/ui/skeleton';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullIndicator } from '@/components/ui/pull-indicator';
import { HealthRing, computeDiversificationScore, computeExitReadiness } from '@/components/ui/health-ring';
import {
  loadCategoryExpandState,
  saveCategoryExpandState,
  getDefaultExpandedCategories
} from '@/lib/categoryExpandState';
import {
  loadLogoRegistry,
  writeLogosToRegistry,
  loadLogoImageIds,
  getLogoImageUrl,
  uploadLogoImage,
  uploadLogoImagesBulk,
} from '@/lib/canisterSync';

const aggregator = getPriceAggregator();
const marketDataService = getMarketDataService();

// Logo cache helpers
const LOGO_CACHE_KEY = 'oft-logo-cache';
function loadLogoCache(): Record<string, string> {
  try {
    const cached = localStorage.getItem(LOGO_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('[LogoCache] Failed to load:', e);
  }
  return {};
}
function saveLogoCache(logos: Record<string, string>): void {
  try {
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify(logos));
  } catch (e) {
    console.warn('[LogoCache] Failed to save:', e);
  }
}

export const PortfolioDashboard = memo(function PortfolioDashboard() {
  const { principal } = useInternetIdentity();
  const { actor } = useActor();
  const store = usePortfolioStore(principal, actor);
  const [prices, setPrices] = useState<Record<string, ExtendedPriceQuote>>({});
  const [logos, setLogos] = useState<Record<string, string>>(() => loadLogoCache());
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

  // Data freshness tracking
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Previous prices for flash effect
  const previousPricesRef = useRef<Record<string, number>>({});
  const [flashStates, setFlashStates] = useState<Record<string, 'up' | 'down' | null>>({});

  // Shared on-chain logo registry: coingeckoId → logoUrl (legacy, for fallback)
  const [logoRegistry, setLogoRegistry] = useState<Map<string, string>>(new Map());
  const logoRegistryLoaded = useRef(false);

  // On-chain logo IMAGE registry: Set of coingeckoIds that have actual image bytes stored
  const [logoImageIds, setLogoImageIds] = useState<Set<string>>(new Set());
  const logoImageIdsLoaded = useRef(false);

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
    setIsRefreshingPrices(true);
    try {
      const quotes = await aggregator.getPrice(symbols);
      const priceMap: Record<string, ExtendedPriceQuote> = {};
      for (const quote of quotes) {
        priceMap[quote.symbol.toUpperCase()] = quote;
      }

      // Compute flash states by comparing to previous prices
      const newFlashStates: Record<string, 'up' | 'down' | null> = {};
      for (const [sym, quote] of Object.entries(priceMap)) {
        const prevPrice = previousPricesRef.current[sym];
        if (prevPrice !== undefined && quote.priceUsd !== prevPrice) {
          newFlashStates[sym] = quote.priceUsd > prevPrice ? 'up' : 'down';
        }
      }
      // Update previous prices ref
      const currentPriceSnapshot: Record<string, number> = {};
      for (const [sym, quote] of Object.entries(priceMap)) {
        currentPriceSnapshot[sym] = quote.priceUsd;
      }
      previousPricesRef.current = currentPriceSnapshot;

      // Set flash states and clear them after animation
      if (Object.keys(newFlashStates).length > 0) {
        setFlashStates(newFlashStates);
        setTimeout(() => setFlashStates({}), 900);
      }

      setPrices(priceMap);
      setLastPriceUpdate(new Date());
      setInitialLoadDone(true);
      
      // Update holdings with fresh market data (stale-while-revalidate persistence)
      marketDataService.refreshForSymbols(symbols);
    } catch (err) {
      console.error('Failed to fetch prices', err);
    } finally {
      setIsRefreshingPrices(false);
    }
  }, [symbols]);

  // Load shared logo registries from canister (once per session)
  useEffect(() => {
    if (!actor || logoRegistryLoaded.current) return;
    logoRegistryLoaded.current = true;

    // Load both URL registry (legacy) and image ID list in parallel
    Promise.all([
      loadLogoRegistry(actor),
      loadLogoImageIds(actor),
    ]).then(([registry, imageIds]) => {
      setLogoRegistry(registry);
      setLogoImageIds(imageIds);
      logoImageIdsLoaded.current = true;
      console.log(`[PortfolioDashboard] Logo registries loaded: ${registry.size} URLs, ${imageIds.size} images`);
    });
  }, [actor]);

  // Pre-seed logo IMAGES if canister has few stored (one-time per browser)
  // Fetches logo URLs from Cloudflare Worker registry, downloads images, uploads bytes to canister
  useEffect(() => {
    if (!actor || !logoImageIdsLoaded.current || logoImageIds.size > 100) return;

    const SEED_KEY = 'oft-logo-images-seeded-v1';
    if (localStorage.getItem(SEED_KEY)) return;

    console.log(`[PortfolioDashboard] Image registry small (${logoImageIds.size}), attempting pre-seed...`);
    (async () => {
      try {
        // Fetch logo URLs from Cloudflare Worker registry (legacy worker name)
        const response = await fetch(
          'https://ysl-price-cache.robertripleyjunior.workers.dev/registry/latest.json'
        );
        if (!response.ok) {
          console.warn(`[PortfolioDashboard] Worker registry returned ${response.status}`);
          return;
        }

        const registry = await response.json();
        const entries: Array<[string, string]> = [];

        // Worker registry format: { byId: { coingeckoId: { logoUrl, ... } } }
        if (registry?.byId) {
          for (const [id, entry] of Object.entries(registry.byId)) {
            const logoUrl = (entry as any)?.logoUrl;
            if (id && logoUrl && !logoImageIds.has(id)) {
              entries.push([id, logoUrl]);
            }
          }
        }

        console.log(`[PortfolioDashboard] ${entries.length} logos to download and upload as images`);

        if (entries.length > 0) {
          // Also seed the URL registry for backward compat
          await writeLogosToRegistry(actor, entries);

          // Download images and upload bytes to canister (in batches of 10)
          const added = await uploadLogoImagesBulk(actor, entries, 10);
          console.log(`[PortfolioDashboard] Pre-seeded ${added} logo images to canister`);
          localStorage.setItem(SEED_KEY, Date.now().toString());

          // Reload image IDs
          const updatedIds = await loadLogoImageIds(actor);
          setLogoImageIds(updatedIds);

          // Also update URL registry
          const updatedRegistry = await loadLogoRegistry(actor);
          setLogoRegistry(updatedRegistry);
        }
      } catch (err) {
        console.warn('[PortfolioDashboard] Image pre-seed failed:', err);
      }
    })();
  }, [actor, logoImageIds.size]);

  // Fetch logos: canister image → CoinGecko fallback → upload to canister
  const fetchLogos = useCallback(async () => {
    if (!symbols.length) return;
    try {
      const allLogos: Record<string, string> = {};
      const symbolsMissingImage: string[] = [];
      const symbolToIdMap: Record<string, string> = {};

      // Step 1: For holdings with coingeckoId that have stored images, use canister URL
      for (const holding of store.holdings) {
        const symbol = holding.symbol.toUpperCase();
        if (holding.coingeckoId) {
          symbolToIdMap[symbol] = holding.coingeckoId;
          if (logoImageIds.has(holding.coingeckoId)) {
            // Image is stored on-chain — use canister HTTP URL directly
            allLogos[symbol] = getLogoImageUrl(holding.coingeckoId);
          } else {
            symbolsMissingImage.push(symbol);
          }
        } else {
          symbolsMissingImage.push(symbol);
        }
      }

      console.log(`[PortfolioDashboard] Image hits: ${Object.keys(allLogos).length}, misses: ${symbolsMissingImage.length}`);

      // Step 2: For misses with coingeckoIds, check URL registry then CoinGecko
      const idsToFetch: Record<string, string> = {};
      for (const sym of symbolsMissingImage) {
        if (symbolToIdMap[sym]) {
          // Check URL registry first
          const registryUrl = logoRegistry.get(symbolToIdMap[sym]);
          if (registryUrl) {
            allLogos[sym] = registryUrl;
          } else {
            idsToFetch[sym] = symbolToIdMap[sym];
          }
        }
      }

      const newImageUploads: Array<[string, string]> = []; // [coingeckoId, logoUrl]

      if (Object.keys(idsToFetch).length > 0) {
        const idBasedLogos = await aggregator.getLogosWithIds(idsToFetch);
        for (const [sym, url] of Object.entries(idBasedLogos)) {
          allLogos[sym] = url;
          const cgId = idsToFetch[sym];
          if (cgId && url) {
            newImageUploads.push([cgId, url]);
          }
        }
      }

      // Step 3: For symbols without coingeckoIds, use symbol-based lookup
      const symbolsWithoutIds = symbolsMissingImage.filter(s => !symbolToIdMap[s]);
      if (symbolsWithoutIds.length > 0) {
        const symbolBasedLogos = await aggregator.getLogos(symbolsWithoutIds);
        for (const [sym, url] of Object.entries(symbolBasedLogos)) {
          allLogos[sym] = url;
        }
      }

      // Step 4: Update React state + localStorage cache
      setLogos(prev => {
        const updated = { ...prev, ...allLogos };
        saveLogoCache(updated);
        return updated;
      });

      // Step 5: Upload newly resolved logos as images to canister (fire-and-forget)
      // This downloads the actual image bytes and stores them on-chain
      if (newImageUploads.length > 0 && actor) {
        // Also write URLs to legacy registry for backward compat
        writeLogosToRegistry(actor, newImageUploads);

        // Upload actual image bytes
        uploadLogoImagesBulk(actor, newImageUploads, 5).then(count => {
          if (count > 0) {
            console.log(`[PortfolioDashboard] Uploaded ${count} new logo images to canister`);
            // Update local state with new IDs so next render uses canister URLs
            setLogoImageIds(prev => {
              const updated = new Set(prev);
              for (const [cgId] of newImageUploads) {
                updated.add(cgId);
              }
              return updated;
            });
            // Also update logos to use canister URLs now
            setLogos(prev => {
              const updated = { ...prev };
              for (const holding of store.holdings) {
                const sym = holding.symbol.toUpperCase();
                if (holding.coingeckoId && newImageUploads.some(([id]) => id === holding.coingeckoId)) {
                  updated[sym] = getLogoImageUrl(holding.coingeckoId);
                }
              }
              saveLogoCache(updated);
              return updated;
            });
          }
        });
      }

      console.log(`[PortfolioDashboard] Set ${Object.keys(allLogos).length} logos total`);
    } catch (err) {
      console.error('Failed to fetch logos', err);
    }
  }, [symbols, store.holdings, logoImageIds, logoRegistry, actor]);

  useEffect(() => {
    fetchPrices();
    fetchLogos();
    const interval = setInterval(fetchPrices, 30_000);
    return () => clearInterval(interval);
  }, [fetchPrices, fetchLogos]);

  // Pull-to-refresh on mobile
  const { pullDistance, isRefreshing: isPullRefreshing, containerRef: pullContainerRef, indicatorStyle } = usePullToRefresh({
    onRefresh: fetchPrices,
  });

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

  // Portfolio-level stats for bento tiles: 24h change, top gainer/loser
  const portfolioStats = useMemo(() => {
    let weightedChange24h = 0;
    let totalWeightForChange = 0;
    let topGainer = { symbol: '', change: -Infinity };
    let topLoser = { symbol: '', change: Infinity };

    for (const holding of store.holdings) {
      const sym = holding.symbol.toUpperCase();
      const priceData = prices[sym];
      if (!priceData) continue;

      const price = priceData.priceUsd ?? 0;
      const value = holding.tokensOwned * price;
      const change24h = priceData.change24h ?? 0;

      // Weight 24h change by position size
      if (value > 0 && change24h !== 0) {
        weightedChange24h += change24h * value;
        totalWeightForChange += value;
      }

      // Track top gainer and loser (skip stablecoins)
      if (Math.abs(change24h) > 0.01) {
        if (change24h > topGainer.change) {
          topGainer = { symbol: sym, change: change24h };
        }
        if (change24h < topLoser.change) {
          topLoser = { symbol: sym, change: change24h };
        }
      }
    }

    const portfolioChange24h = totalWeightForChange > 0
      ? weightedChange24h / totalWeightForChange
      : 0;

    return {
      change24h: portfolioChange24h,
      topGainer: topGainer.symbol ? topGainer : null,
      topLoser: topLoser.symbol ? topLoser : null,
    };
  }, [store.holdings, prices]);

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

  // Load raw exit plans from localStorage (oft-exit-plans key) - for NearestExits component
  // This preserves the full structure with rungs array
  const exitPlanStates = useMemo(() => {
    try {
      const stored = localStorage.getItem('oft-exit-plans');
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

  // Portfolio health ring scores
  const healthScores = useMemo(() => {
    const diversification = computeDiversificationScore(totals.byCategory, totals.totalValue);
    // Count non-stablecoin holdings that have exit plans
    const nonStableHoldings = store.holdings.filter(h => {
      const sym = h.symbol.toUpperCase();
      return !['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDD', 'FRAX'].includes(sym);
    });
    const holdingsWithPlans = nonStableHoldings.filter(h => {
      const plan = exitPlans[h.id];
      return plan && plan.length > 0;
    }).length;
    const exitReadiness = computeExitReadiness(nonStableHoldings.length, holdingsWithPlans);
    const pnlTrend: 'up' | 'down' | 'flat' = portfolioStats.change24h > 0.5 ? 'up' : portfolioStats.change24h < -0.5 ? 'down' : 'flat';

    return { diversification, exitReadiness, pnlTrend };
  }, [totals, store.holdings, exitPlans, portfolioStats.change24h]);

  // Show guided first-action when user has no holdings at all
  const showEmptyState = store.holdings.length === 0 && store.cash === 0;

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
    <div ref={pullContainerRef as any} className="space-y-4">
      {/* Pull-to-refresh indicator (mobile only) */}
      <PullIndicator
        pullDistance={pullDistance}
        isRefreshing={isPullRefreshing}
        style={indicatorStyle}
      />

      {showEmptyState ? (
        <Card className="glass-panel border-divide/80 py-10 shadow-[0_22px_60px_rgba(0,0,0,0.8)]">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center px-4">
            {/* Animated icon */}
            <div className="relative mb-5">
              <div className="absolute inset-0 w-16 h-16 rounded-full bg-gradient-to-br from-[var(--brand-gradient-from)]/15 to-[var(--brand-gradient-to)]/15 animate-pulse" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <TrendingUp className="h-7 w-7" />
              </div>
            </div>
            <h3 className="mb-1 text-lg font-semibold font-heading text-foreground">Add your first positions</h3>
            <p className="mb-6 text-sm text-muted-foreground max-w-sm">
              Start tracking your crypto portfolio. Add what you hold and we'll pull live prices automatically.
            </p>
            {/* Quick-add popular tokens */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {['BTC', 'ETH', 'SOL', 'ICP', 'XRP', 'ADA'].map((sym, idx) => (
                <button
                  key={sym}
                  onClick={() => { setPrefilledSymbol(sym); setShowUnifiedModal(true); }}
                  className="stagger-item px-3 py-1.5 rounded-full bg-secondary/40 border border-divide-lighter/15 text-xs font-medium text-foreground/70 hover:bg-secondary/70 hover:text-foreground hover:border-divide-lighter/30 transition-smooth"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  + {sym}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="rounded-full bg-gradient-to-r from-primary to-primary/60 px-5 text-xs font-medium shadow-lg shadow-primary/30 transition-smooth hover:shadow-primary/50"
              onClick={handleAddAssetClick}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Search for any asset
            </Button>
            <button
              onClick={() => {/* Skip — empty table will show */}}
              className="mt-3 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-smooth"
            >
              I'll explore first →
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* ── Bento Hero Row ─────────────────────────────────── */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {/* Hero: Total Value (spans 2 cols) */}
            <Card className="glass-panel border-divide/80 !p-0 col-span-2 stagger-item">
              <div className="px-4 pt-3 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Health Ring (hidden on very small screens) */}
                    {store.holdings.length > 0 && (
                      <div className="hidden sm:block flex-shrink-0 mt-0.5">
                        <HealthRing
                          diversification={healthScores.diversification}
                          exitReadiness={healthScores.exitReadiness}
                          pnlTrend={healthScores.pnlTrend}
                          size={64}
                        />
                      </div>
                    )}
                    <div>
                      <div
                        className="inline-block rounded-lg px-3 py-1 -mx-3 -my-1"
                        style={{
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px rgba(139, 92, 246, 0.15)'
                        }}
                      >
                        <AnimatedNumber
                          value={totals.totalValue}
                          duration={700}
                          className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground"
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground">Total value</span>
                        <DataFreshness
                          lastUpdated={lastPriceUpdate}
                          isRefreshing={isRefreshingPrices}
                        />
                      </div>
                    </div>
                  </div>
                  {portfolioStats.change24h !== 0 && (
                    <GainLossPill
                      value={portfolioStats.change24h}
                      format="percent"
                      size="sm"
                    />
                  )}
                </div>
              </div>
            </Card>

            {/* Top Gainer tile */}
            <Card className="glass-panel border-divide/80 !p-0 stagger-item" style={{ animationDelay: '80ms' }}>
              <div className="px-3 py-3 flex flex-col justify-between h-full">
                <div className="flex items-center gap-1 text-muted-foreground/50">
                  <ArrowUpRight className="h-3 w-3 text-emerald-400/70" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">Top Gainer</span>
                </div>
                {portfolioStats.topGainer ? (
                  <div className="mt-1.5">
                    <span className="text-sm font-semibold text-foreground/90">{portfolioStats.topGainer.symbol}</span>
                    <GainLossPill value={portfolioStats.topGainer.change} format="percent" size="xs" className="ml-2" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/40 mt-1.5">—</span>
                )}
              </div>
            </Card>

            {/* Top Loser tile */}
            <Card className="glass-panel border-divide/80 !p-0 stagger-item" style={{ animationDelay: '160ms' }}>
              <div className="px-3 py-3 flex flex-col justify-between h-full">
                <div className="flex items-center gap-1 text-muted-foreground/50">
                  <ArrowDownRight className="h-3 w-3 text-red-400/70" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">Top Loser</span>
                </div>
                {portfolioStats.topLoser ? (
                  <div className="mt-1.5">
                    <span className="text-sm font-semibold text-foreground/90">{portfolioStats.topLoser.symbol}</span>
                    <GainLossPill value={portfolioStats.topLoser.change} format="percent" size="xs" className="ml-2" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/40 mt-1.5">—</span>
                )}
              </div>
            </Card>
          </div>

          {/* ── Main Content: Holdings + Sidebar ──────────────── */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,3.5fr)_minmax(0,1.8fr)]">
            {/* Holdings Table */}
            <div className="min-w-0">
              <CompactHoldingsTable
                groups={groups}
                prices={prices}
                logos={logos}
                totals={totals}
                expandedCategories={expandedCategories}
                onToggleCategory={toggleCategory}
                flashStates={flashStates}
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

            {/* Sidebar: Allocation + Exits */}
            <div className="space-y-4">
              {/* Allocation Donut */}
              <Card className="glass-panel border-divide/80 !p-0">
                <div className="px-4 pt-3 pb-1.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground/60">
                    <PieChart className="h-4 w-4" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Allocation</span>
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
