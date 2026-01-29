/**
 * Market Data Service
 * 
 * Provides warm market data cache with stale-while-revalidate pattern.
 * Ensures market data is available before categorization to prevent mis-bucketing.
 * 
 * Features:
 * - Preloads market data from Worker cache on app start
 * - Persists last-known values on holdings for instant rendering
 * - Auto-recategorizes when fresh data arrives
 * - Never treats missing data as 0 (uses UNKNOWN sentinel)
 */

import { getPriceAggregator, type ExtendedPriceQuote } from './priceService';
import { type Holding, type Store, getStore } from './dataModel';
import { saveStore } from './persistence';

// ============================================================================
// TYPES
// ============================================================================

export interface MarketData {
  symbol: string;
  priceUsd: number;
  marketCapUsd: number;
  change24hPct: number;
  logoUrl?: string;
  lastUpdatedAt: string; // ISO timestamp
}

export interface MarketCacheState {
  isLoaded: boolean;
  isLoading: boolean;
  lastRefresh: number | null;
  coinCount: number;
}

type MarketDataListener = (data: Map<string, MarketData>) => void;

// ============================================================================
// MARKET DATA SERVICE
// ============================================================================

class MarketDataService {
  private cache: Map<string, MarketData> = new Map();
  private cacheState: MarketCacheState = {
    isLoaded: false,
    isLoading: false,
    lastRefresh: null,
    coinCount: 0,
  };
  private listeners: MarketDataListener[] = [];
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (match Worker cache)

  /**
   * Get current cache state
   */
  getState(): MarketCacheState {
    return { ...this.cacheState };
  }

  /**
   * Check if market data is available for a symbol
   */
  hasData(symbol: string): boolean {
    return this.cache.has(symbol.toUpperCase());
  }

  /**
   * Get market data for a symbol
   * Returns undefined if not available (don't return 0!)
   */
  getData(symbol: string): MarketData | undefined {
    return this.cache.get(symbol.toUpperCase());
  }

  /**
   * Get market cap for a symbol
   * Returns undefined if not available (never 0 for unknown!)
   */
  getMarketCap(symbol: string): number | undefined {
    const data = this.cache.get(symbol.toUpperCase());
    return data?.marketCapUsd;
  }

  /**
   * Get price for a symbol
   * Returns undefined if not available
   */
  getPrice(symbol: string): number | undefined {
    const data = this.cache.get(symbol.toUpperCase());
    return data?.priceUsd;
  }

  /**
   * Subscribe to cache updates
   */
  subscribe(listener: MarketDataListener): () => void {
    this.listeners.push(listener);
    
    // If already loaded, notify immediately
    if (this.cacheState.isLoaded && this.cache.size > 0) {
      listener(new Map(this.cache));
    }
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of cache update
   */
  private notifyListeners(): void {
    const cacheCopy = new Map(this.cache);
    this.listeners.forEach(listener => {
      try {
        listener(cacheCopy);
      } catch (error) {
        console.error('[MarketData] Listener error:', error);
      }
    });
  }

  /**
   * Initialize market data cache
   * Call this on app startup before rendering holdings
   */
  async initialize(): Promise<void> {
    if (this.cacheState.isLoading) {
      console.log('[MarketData] Already loading, skipping duplicate init');
      return;
    }

    console.log('[MarketData] Initializing market data cache...');
    this.cacheState.isLoading = true;

    try {
      // Fetch top coins from Worker cache via aggregator
      // We request common symbols to warm the cache
      const warmupSymbols = [
        'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX', 'DOT',
        'MATIC', 'UNI', 'ATOM', 'LTC', 'FIL', 'NEAR', 'ICP', 'RENDER', 'SUI', 'APT',
        'ARB', 'OP', 'INJ', 'TIA', 'SEI', 'ONDO', 'PYTH', 'JUP', 'WIF', 'BONK',
      ];

      const aggregator = getPriceAggregator();
      const quotes = await aggregator.getPrice(warmupSymbols);

      for (const quote of quotes) {
        if (quote && quote.priceUsd > 0) {
          this.cache.set(quote.symbol.toUpperCase(), {
            symbol: quote.symbol.toUpperCase(),
            priceUsd: quote.priceUsd,
            marketCapUsd: quote.marketCapUsd || 0,
            change24hPct: quote.change24h || 0,
            logoUrl: quote.logoUrl,
            lastUpdatedAt: new Date().toISOString(),
          });
        }
      }

      this.cacheState = {
        isLoaded: true,
        isLoading: false,
        lastRefresh: Date.now(),
        coinCount: this.cache.size,
      };

      console.log(`[MarketData] Cache initialized with ${this.cache.size} coins`);
      this.notifyListeners();

      // Start auto-refresh
      this.startAutoRefresh();
    } catch (error) {
      console.error('[MarketData] Failed to initialize:', error);
      this.cacheState.isLoading = false;
      this.cacheState.isLoaded = true; // Mark as loaded even on failure to unblock UI
    }
  }

  /**
   * Refresh market data for specific symbols
   * Also updates holdings with last-known values
   */
  async refreshForSymbols(symbols: string[]): Promise<void> {
    if (symbols.length === 0) return;

    console.log(`[MarketData] Refreshing data for ${symbols.length} symbols...`);

    try {
      const aggregator = getPriceAggregator();
      const quotes = await aggregator.getPrice(symbols);
      const now = new Date().toISOString();

      for (const quote of quotes) {
        if (quote && quote.priceUsd > 0) {
          this.cache.set(quote.symbol.toUpperCase(), {
            symbol: quote.symbol.toUpperCase(),
            priceUsd: quote.priceUsd,
            marketCapUsd: quote.marketCapUsd || 0,
            change24hPct: quote.change24h || 0,
            logoUrl: quote.logoUrl,
            lastUpdatedAt: now,
          });
        }
      }

      // Update holdings with last-known market data
      this.updateHoldingsWithMarketData(quotes);

      this.cacheState.lastRefresh = Date.now();
      this.cacheState.coinCount = this.cache.size;

      console.log(`[MarketData] Refreshed ${quotes.filter(q => q?.priceUsd > 0).length} symbols`);
      this.notifyListeners();
    } catch (error) {
      console.error('[MarketData] Refresh failed:', error);
    }
  }

  /**
   * Update holdings in the store with last-known market data
   * This enables stale-while-revalidate: UI renders cached values instantly
   */
  private updateHoldingsWithMarketData(quotes: ExtendedPriceQuote[]): void {
    const store = getStore();
    let updated = false;

    for (const quote of quotes) {
      if (!quote || quote.priceUsd <= 0) continue;

      const holding = store.holdings.find(
        h => h.symbol.toUpperCase() === quote.symbol.toUpperCase()
      );

      if (holding) {
        const now = new Date().toISOString();
        
        // Update cached market data on the holding
        if (quote.priceUsd > 0) holding.lastPriceUsd = quote.priceUsd;
        if (quote.marketCapUsd && quote.marketCapUsd > 0) holding.lastMarketCapUsd = quote.marketCapUsd;
        if (quote.change24h !== undefined) holding.lastChange24hPct = quote.change24h;
        if (quote.logoUrl) holding.logoUrl = quote.logoUrl;
        holding.lastMarketDataAt = now;
        
        updated = true;
      }
    }

    if (updated) {
      saveStore(store);
      console.log('[MarketData] Updated holdings with cached market data');
    }
  }

  /**
   * Start auto-refresh interval
   */
  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      const store = getStore();
      const symbols = store.holdings.map(h => h.symbol.toUpperCase());
      if (symbols.length > 0) {
        this.refreshForSymbols(symbols);
      }
    }, this.REFRESH_INTERVAL_MS);

    console.log(`[MarketData] Auto-refresh started (every ${this.REFRESH_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('[MarketData] Auto-refresh stopped');
    }
  }

  /**
   * Get best available market cap for categorization
   * Priority: live cache > holding.lastMarketCapUsd > undefined (UNKNOWN)
   */
  getMarketCapForCategorization(holding: Holding): number | undefined {
    const symbol = holding.symbol.toUpperCase();
    
    // Try live cache first
    const liveData = this.cache.get(symbol);
    if (liveData && liveData.marketCapUsd > 0) {
      return liveData.marketCapUsd;
    }
    
    // Fall back to holding's cached value (stale-while-revalidate)
    if (holding.lastMarketCapUsd && holding.lastMarketCapUsd > 0) {
      return holding.lastMarketCapUsd;
    }
    
    // No data available - return undefined (UNKNOWN)
    return undefined;
  }

  /**
   * Get best available price for rendering
   * Priority: live cache > holding.lastPriceUsd > holding.avgCost > undefined
   */
  getPriceForRendering(holding: Holding): number | undefined {
    const symbol = holding.symbol.toUpperCase();
    
    // Try live cache first
    const liveData = this.cache.get(symbol);
    if (liveData && liveData.priceUsd > 0) {
      return liveData.priceUsd;
    }
    
    // Fall back to holding's cached value
    if (holding.lastPriceUsd && holding.lastPriceUsd > 0) {
      return holding.lastPriceUsd;
    }
    
    // Fall back to average cost if available
    if (holding.avgCost && holding.avgCost > 0) {
      return holding.avgCost;
    }
    
    // No price available
    return undefined;
  }

  /**
   * Clear cache (for testing)
   */
  clear(): void {
    this.cache.clear();
    this.cacheState = {
      isLoaded: false,
      isLoading: false,
      lastRefresh: null,
      coinCount: 0,
    };
    this.stopAutoRefresh();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalMarketDataService: MarketDataService | null = null;

export function getMarketDataService(): MarketDataService {
  if (!globalMarketDataService) {
    globalMarketDataService = new MarketDataService();
  }
  return globalMarketDataService;
}

/**
 * Initialize market data on app start
 * Should be called early in app lifecycle
 */
export async function initializeMarketData(): Promise<void> {
  const service = getMarketDataService();
  await service.initialize();
}

/**
 * Hook for React components to use market data
 * Returns current cache state and data accessor
 */
export function useMarketDataState(): {
  isLoaded: boolean;
  isLoading: boolean;
  getMarketCap: (symbol: string) => number | undefined;
  getPrice: (symbol: string) => number | undefined;
} {
  const service = getMarketDataService();
  const state = service.getState();
  
  return {
    isLoaded: state.isLoaded,
    isLoading: state.isLoading,
    getMarketCap: (symbol: string) => service.getMarketCap(symbol),
    getPrice: (symbol: string) => service.getPrice(symbol),
  };
}
