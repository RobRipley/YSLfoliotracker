/**
 * Price Fetching & Aggregation Module
 * 
 * Uses CryptoRates.ai free service (top 5000 coins, no rate limits, 5-min updates)
 * - Fetches all coins once and caches in memory + localStorage
 * - Falls back to CoinGecko if CryptoRates.ai fails
 * - Emits events for significant price/marketCap changes (>1%)
 */

import { PriceQuote } from './dataModel';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ExtendedPriceQuote extends PriceQuote {
  marketCapUsd?: number;
  volume24h?: number;
  change24h?: number;
  stale?: boolean;
}

export type PriceChangeEvent = {
  symbol: string;
  oldPrice: number;
  newPrice: number;
  priceChangePercent: number;
  oldMarketCap?: number;
  newMarketCap?: number;
  marketCapChangePercent?: number;
};

export type EventListener = (event: PriceChangeEvent) => void;

// ============================================================================
// CRYPTORATES.AI PROVIDER (Primary - Free, No Limits)
// ============================================================================

interface CryptoRatesCoin {
  symbol: string;
  name: string;
  price: number;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
}

class CryptoRatesProvider {
  private cache: Map<string, CryptoRatesCoin> = new Map();
  private lastFetch: number = 0;
  private readonly cacheTTL: number = 5 * 60 * 1000; // 5 minutes (matches their update frequency)
  private readonly localStorageKey = 'cryptorates_cache';
  private readonly localStorageTimestampKey = 'cryptorates_cache_timestamp';

  constructor() {
    this.loadFromLocalStorage();
  }

  /**
   * Load cached data from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const cached = localStorage.getItem(this.localStorageKey);
      const timestamp = localStorage.getItem(this.localStorageTimestampKey);
      
      if (cached && timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        
        if (age < this.cacheTTL) {
          const data: CryptoRatesCoin[] = JSON.parse(cached);
          this.cache = new Map(data.map(coin => [coin.symbol.toUpperCase(), coin]));
          this.lastFetch = parseInt(timestamp, 10);
          console.log('[CryptoRates] Loaded', this.cache.size, 'coins from localStorage');
        }
      }
    } catch (error) {
      console.warn('[CryptoRates] Failed to load from localStorage:', error);
    }
  }

  /**
   * Save cached data to localStorage
   */
  private saveToLocalStorage(): void {
    try {
      const data = Array.from(this.cache.values());
      localStorage.setItem(this.localStorageKey, JSON.stringify(data));
      localStorage.setItem(this.localStorageTimestampKey, this.lastFetch.toString());
    } catch (error) {
      console.warn('[CryptoRates] Failed to save to localStorage:', error);
    }
  }

  /**
   * Fetch all coins from CryptoRates.ai API
   */
  private async fetchAllCoins(): Promise<void> {
    const response = await fetch('https://cryptorates.ai/v1/coins/all');
    
    if (!response.ok) {
      throw new Error(`CryptoRates API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse the response - format may vary, handle both array and object
    let coins: CryptoRatesCoin[] = [];
    
    if (Array.isArray(data)) {
      coins = data;
    } else if (data.data && Array.isArray(data.data)) {
      coins = data.data;
    } else {
      throw new Error('Unexpected CryptoRates API response format');
    }

    // Build the cache
    this.cache.clear();
    for (const coin of coins) {
      const symbol = coin.symbol?.toUpperCase();
      if (symbol && coin.price) {
        this.cache.set(symbol, {
          symbol,
          name: coin.name || symbol,
          price: coin.price,
          marketCap: coin.marketCap,
          volume24h: coin.volume24h,
          change24h: coin.change24h,
        });
      }
    }

    this.lastFetch = Date.now();
    this.saveToLocalStorage();
    
    console.log('[CryptoRates] Fetched', this.cache.size, 'coins');
  }

  /**
   * Get prices for multiple symbols
   */
  async getPrice(symbols: string[]): Promise<ExtendedPriceQuote[]> {
    // Refresh cache if expired
    const now = Date.now();
    if (now - this.lastFetch > this.cacheTTL || this.cache.size === 0) {
      await this.fetchAllCoins();
    }

    // Look up each symbol in cache
    return symbols.map(symbol => {
      const normalizedSymbol = symbol.toUpperCase();
      const coin = this.cache.get(normalizedSymbol);

      if (!coin) {
        throw new Error(`Symbol not found: ${symbol}`);
      }

      return {
        symbol: normalizedSymbol,
        priceUsd: coin.price,
        marketCapUsd: coin.marketCap,
        timestamp: this.lastFetch,
      };
    });
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
    this.lastFetch = 0;
    localStorage.removeItem(this.localStorageKey);
    localStorage.removeItem(this.localStorageTimestampKey);
  }
}

// ============================================================================
// COINGECKO PROVIDER (Fallback)
// ============================================================================

class CoinGeckoProvider {
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  
  // Map common symbols to CoinGecko IDs
  private symbolToId: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'BNB': 'binancecoin',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'LINK': 'chainlink',
    'RENDER': 'render-token',
    'ONDO': 'ondo-finance',
    'SUI': 'sui',
    'NEAR': 'near',
    'ICP': 'internet-computer',
  };

  async getPrice(symbols: string[]): Promise<ExtendedPriceQuote[]> {
    // Convert symbols to CoinGecko IDs
    const ids = symbols
      .map(s => this.symbolToId[s.toUpperCase()] || s.toLowerCase())
      .join(',');
    
    const response = await fetch(
      `${this.baseUrl}/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const now = Date.now();

    return symbols.map(symbol => {
      const id = this.symbolToId[symbol.toUpperCase()] || symbol.toLowerCase();
      const priceData = data[id];

      if (!priceData) {
        throw new Error(`No data for symbol ${symbol}`);
      }

      return {
        symbol: symbol.toUpperCase(),
        priceUsd: priceData.usd || 0,
        marketCapUsd: priceData.usd_market_cap,
        timestamp: now,
      };
    });
  }
}

// ============================================================================
// MOCK PROVIDER (for development/testing)
// ============================================================================

export class MockPriceProvider {
  private prices: Map<string, { price: number; marketCap: number }> = new Map();
  private updateInterval?: NodeJS.Timeout;

  constructor() {
    // Blue Chip (>= $10B)
    this.prices.set('BTC', { price: 103000, marketCap: 2_040_000_000_000 });
    this.prices.set('ETH', { price: 3450, marketCap: 415_000_000_000 });
    this.prices.set('SOL', { price: 158, marketCap: 75_000_000_000 });
    this.prices.set('BNB', { price: 963, marketCap: 140_000_000_000 });
    this.prices.set('LINK', { price: 15.69, marketCap: 10_000_000_000 });
    
    // Mid Cap ($1B - $10B)
    this.prices.set('RENDER', { price: 2.44, marketCap: 1_200_000_000 });
    this.prices.set('SUI', { price: 2.05, marketCap: 6_500_000_000 });
    this.prices.set('NEAR', { price: 2.62, marketCap: 3_200_000_000 });
    this.prices.set('ICP', { price: 3.12, marketCap: 3_000_000_000 });
    
    // Low Cap ($10M - $1B)
    this.prices.set('ONDO', { price: 0.66, marketCap: 900_000_000 });
    this.prices.set('KMNO', { price: 0.061, marketCap: 45_000_000 });
  }

  startRandomWalk(intervalMs: number = 5000): void {
    this.updateInterval = setInterval(() => {
      this.prices.forEach((data) => {
        const priceChange = (Math.random() - 0.5) * 0.04;
        const marketCapChange = (Math.random() - 0.5) * 0.04;
        data.price *= (1 + priceChange);
        data.marketCap *= (1 + marketCapChange);
      });
    }, intervalMs);
  }

  stopRandomWalk(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  async getPrice(symbols: string[]): Promise<ExtendedPriceQuote[]> {
    const now = Date.now();
    
    return symbols.map(symbol => {
      const normalizedSymbol = symbol.toUpperCase();
      const data = this.prices.get(normalizedSymbol);
      
      if (!data) {
        return {
          symbol: normalizedSymbol,
          priceUsd: 1.0,
          marketCapUsd: 100_000_000,
          timestamp: now,
        };
      }

      return {
        symbol: normalizedSymbol,
        priceUsd: data.price,
        marketCapUsd: data.marketCap,
        timestamp: now,
      };
    });
  }
}

// ============================================================================
// PRICE AGGREGATOR
// ============================================================================

export class PriceAggregator {
  private primaryProvider: CryptoRatesProvider | MockPriceProvider;
  private fallbackProvider: CoinGeckoProvider;
  private listeners: EventListener[] = [];
  private lastKnownQuotes: Map<string, ExtendedPriceQuote> = new Map();
  private lastEmitTime: Map<string, number> = new Map();
  private readonly emitThrottle: number = 2000; // Max 1 event per 2 seconds per symbol

  constructor(useMock: boolean = false) {
    if (useMock) {
      const mockProvider = new MockPriceProvider();
      mockProvider.startRandomWalk(5000);
      this.primaryProvider = mockProvider;
    } else {
      this.primaryProvider = new CryptoRatesProvider();
    }
    this.fallbackProvider = new CoinGeckoProvider();
  }

  /**
   * Subscribe to price change events
   */
  on(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Emit price change event with throttling
   */
  private emit(event: PriceChangeEvent): void {
    const now = Date.now();
    const lastEmit = this.lastEmitTime.get(event.symbol) || 0;
    
    if (now - lastEmit < this.emitThrottle) {
      return;
    }
    
    this.lastEmitTime.set(event.symbol, now);
    
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[Aggregator] Error in listener:', error);
      }
    });
  }

  /**
   * Check if quote changed significantly (>1%)
   */
  private checkSignificantChange(
    oldQuote: ExtendedPriceQuote,
    newQuote: ExtendedPriceQuote
  ): void {
    const priceChangePercent = Math.abs(
      ((newQuote.priceUsd - oldQuote.priceUsd) / oldQuote.priceUsd) * 100
    );

    let marketCapChangePercent: number | undefined;
    if (oldQuote.marketCapUsd && newQuote.marketCapUsd) {
      marketCapChangePercent = Math.abs(
        ((newQuote.marketCapUsd - oldQuote.marketCapUsd) / oldQuote.marketCapUsd) * 100
      );
    }

    if (priceChangePercent > 1 || (marketCapChangePercent && marketCapChangePercent > 1)) {
      this.emit({
        symbol: newQuote.symbol,
        oldPrice: oldQuote.priceUsd,
        newPrice: newQuote.priceUsd,
        priceChangePercent,
        oldMarketCap: oldQuote.marketCapUsd,
        newMarketCap: newQuote.marketCapUsd,
        marketCapChangePercent,
      });
    }
  }

  /**
   * Get prices for multiple symbols with fallback
   */
  async getPrice(symbols: string[]): Promise<ExtendedPriceQuote[]> {
    const normalizedSymbols = symbols.map(s => s.toUpperCase());

    try {
      // Try primary provider (CryptoRates or Mock)
      const quotes = await this.primaryProvider.getPrice(normalizedSymbols);
      
      // Check for significant changes and emit events
      quotes.forEach(quote => {
        const lastKnown = this.lastKnownQuotes.get(quote.symbol);
        if (lastKnown && !quote.stale) {
          this.checkSignificantChange(lastKnown, quote);
        }
        this.lastKnownQuotes.set(quote.symbol, quote);
      });
      
      return quotes;
    } catch (primaryError) {
      console.warn('[Aggregator] Primary provider failed, trying fallback:', primaryError);

      try {
        // Try fallback provider (CoinGecko)
        const quotes = await this.fallbackProvider.getPrice(normalizedSymbols);
        
        quotes.forEach(quote => {
          this.lastKnownQuotes.set(quote.symbol, quote);
        });
        
        return quotes;
      } catch (fallbackError) {
        console.error('[Aggregator] Both providers failed:', fallbackError);

        // Return stale data if available
        return normalizedSymbols.map(symbol => {
          const lastKnown = this.lastKnownQuotes.get(symbol);
          if (lastKnown) {
            return { ...lastKnown, stale: true };
          }
          
          // No data available
          return {
            symbol,
            priceUsd: 0,
            timestamp: Date.now(),
            stale: true,
          };
        });
      }
    }
  }

  /**
   * Get current price for a single symbol (convenience method)
   */
  async getCurrentPrice(symbol: string): Promise<number> {
    const quotes = await this.getPrice([symbol]);
    return quotes[0]?.priceUsd || 0;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalAggregator: PriceAggregator | null = null;

/**
 * Get or create the global price aggregator
 */
export function getPriceAggregator(useMock: boolean = false): PriceAggregator {
  if (!globalAggregator) {
    globalAggregator = new PriceAggregator(useMock);
  }
  return globalAggregator;
}

/**
 * Reset the global aggregator (useful for testing)
 */
export function resetGlobalAggregator(): void {
  globalAggregator = null;
}
