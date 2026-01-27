/**
 * Price Fetching & Aggregation Module
 * 
 * Provider Priority:
 * 1. CryptoRates.ai - Free bulk API (5000+ coins, no rate limits, 5-min updates)
 * 2. CryptoPrices.cc - Simple per-symbol API (price only, no market cap)
 * 3. CoinGecko - Reliable fallback with market cap data
 * 
 * All providers normalize symbols to UPPERCASE for consistency.
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
  private readonly cacheTTL: number = 5 * 60 * 1000; // 5 minutes
  private readonly localStorageKey = 'cryptorates_cache';
  private readonly localStorageTimestampKey = 'cryptorates_cache_timestamp';

  constructor() {
    this.loadFromLocalStorage();
  }

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

  private saveToLocalStorage(): void {
    try {
      const data = Array.from(this.cache.values());
      localStorage.setItem(this.localStorageKey, JSON.stringify(data));
      localStorage.setItem(this.localStorageTimestampKey, this.lastFetch.toString());
    } catch (error) {
      console.warn('[CryptoRates] Failed to save to localStorage:', error);
    }
  }

  private async fetchAllCoins(): Promise<void> {
    const response = await fetch('https://cryptorates.ai/v1/coins/all');
    
    if (!response.ok) {
      throw new Error(`CryptoRates API error: ${response.status}`);
    }

    const data = await response.json();
    let coins: CryptoRatesCoin[] = [];
    
    if (Array.isArray(data)) {
      coins = data;
    } else if (data.data && Array.isArray(data.data)) {
      coins = data.data;
    } else {
      throw new Error('Unexpected CryptoRates API response format');
    }

    this.cache.clear();
    for (const coin of coins) {
      // Normalize symbol to UPPERCASE
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
   * Get prices for multiple symbols.
   * Returns partial results - missing symbols get null instead of throwing.
   */
  async getPrice(symbols: string[]): Promise<(ExtendedPriceQuote | null)[]> {
    const now = Date.now();
    if (now - this.lastFetch > this.cacheTTL || this.cache.size === 0) {
      await this.fetchAllCoins();
    }

    return symbols.map(symbol => {
      // Normalize to UPPERCASE for lookup
      const normalizedSymbol = symbol.toUpperCase();
      const coin = this.cache.get(normalizedSymbol);

      if (!coin) {
        console.warn(`[CryptoRates] Symbol not found: ${normalizedSymbol}`);
        return null; // Return null instead of throwing
      }

      return {
        symbol: normalizedSymbol,
        priceUsd: coin.price,
        marketCapUsd: coin.marketCap,
        timestamp: this.lastFetch,
      };
    });
  }

  clearCache(): void {
    this.cache.clear();
    this.lastFetch = 0;
    localStorage.removeItem(this.localStorageKey);
    localStorage.removeItem(this.localStorageTimestampKey);
  }
}

// ============================================================================
// CRYPTOPRICES.CC PROVIDER (Secondary Fallback - Simple per-symbol API)
// ============================================================================

class CryptoPricesProvider {
  /**
   * Fetch price for a single symbol from cryptoprices.cc
   * URL format: https://cryptoprices.cc/BTC (ticker in UPPERCASE)
   * Returns just the price as a number (no market cap data)
   */
  async getSinglePrice(symbol: string): Promise<number | null> {
    try {
      // Symbol must be UPPERCASE
      const normalizedSymbol = symbol.toUpperCase();
      const response = await fetch(`https://cryptoprices.cc/${normalizedSymbol}`);
      
      if (!response.ok) {
        console.warn(`[CryptoPrices] Failed for ${normalizedSymbol}: ${response.status}`);
        return null;
      }

      const text = await response.text();
      const price = parseFloat(text.trim());
      
      if (isNaN(price)) {
        console.warn(`[CryptoPrices] Invalid price for ${normalizedSymbol}: ${text}`);
        return null;
      }

      console.log(`[CryptoPrices] Got ${normalizedSymbol}: $${price}`);
      return price;
    } catch (error) {
      console.warn(`[CryptoPrices] Error fetching ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch prices for multiple symbols (sequential to avoid rate limits)
   */
  async getPrice(symbols: string[]): Promise<(ExtendedPriceQuote | null)[]> {
    const now = Date.now();
    const results: (ExtendedPriceQuote | null)[] = [];

    for (const symbol of symbols) {
      const normalizedSymbol = symbol.toUpperCase();
      const price = await this.getSinglePrice(normalizedSymbol);
      
      if (price !== null) {
        results.push({
          symbol: normalizedSymbol,
          priceUsd: price,
          marketCapUsd: undefined, // CryptoPrices.cc doesn't provide market cap
          timestamp: now,
        });
      } else {
        results.push(null);
      }
    }

    return results;
  }
}

// ============================================================================
// COINGECKO PROVIDER (Last Resort Fallback)
// ============================================================================

class CoinGeckoProvider {
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  
  // Map common symbols (UPPERCASE) to CoinGecko IDs
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
    'KMNO': 'kamino',
    'DEEP': 'deepbook-protocol',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'AVAX': 'avalanche-2',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'ATOM': 'cosmos',
    'UNI': 'uniswap',
    'AAVE': 'aave',
    'FIL': 'filecoin',
    'ARB': 'arbitrum',
    'OP': 'optimism',
  };

  async getPrice(symbols: string[]): Promise<(ExtendedPriceQuote | null)[]> {
    // Convert symbols to CoinGecko IDs (use UPPERCASE for lookup)
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
      const normalizedSymbol = symbol.toUpperCase();
      const id = this.symbolToId[normalizedSymbol] || symbol.toLowerCase();
      const priceData = data[id];

      if (!priceData) {
        console.warn(`[CoinGecko] No data for ${normalizedSymbol} (id: ${id})`);
        return null;
      }

      return {
        symbol: normalizedSymbol,
        priceUsd: priceData.usd || 0,
        marketCapUsd: priceData.usd_market_cap || 0,
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
    this.prices.set('DEEP', { price: 0.15, marketCap: 80_000_000 });
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

  async getPrice(symbols: string[]): Promise<(ExtendedPriceQuote | null)[]> {
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
  private secondaryProvider: CryptoPricesProvider;
  private fallbackProvider: CoinGeckoProvider;
  private listeners: EventListener[] = [];
  private lastKnownQuotes: Map<string, ExtendedPriceQuote> = new Map();
  private lastEmitTime: Map<string, number> = new Map();
  private readonly emitThrottle: number = 2000;

  constructor(useMock: boolean = false) {
    if (useMock) {
      const mockProvider = new MockPriceProvider();
      mockProvider.startRandomWalk(5000);
      this.primaryProvider = mockProvider;
    } else {
      this.primaryProvider = new CryptoRatesProvider();
    }
    this.secondaryProvider = new CryptoPricesProvider();
    this.fallbackProvider = new CoinGeckoProvider();
  }

  on(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: PriceChangeEvent): void {
    const now = Date.now();
    const lastEmit = this.lastEmitTime.get(event.symbol) || 0;
    
    if (now - lastEmit < this.emitThrottle) return;
    
    this.lastEmitTime.set(event.symbol, now);
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[Aggregator] Error in listener:', error);
      }
    });
  }

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
   * Get prices with multi-tier fallback:
   * 1. Try CryptoRates.ai for all symbols
   * 2. For missing symbols, try CryptoPrices.cc
   * 3. For still missing, try CoinGecko
   * 4. Return stale data or zeros for anything still missing
   */
  async getPrice(symbols: string[]): Promise<ExtendedPriceQuote[]> {
    const normalizedSymbols = symbols.map(s => s.toUpperCase());
    const results: Map<string, ExtendedPriceQuote> = new Map();
    let missingSymbols: string[] = [...normalizedSymbols];

    // Step 1: Try primary provider (CryptoRates.ai)
    try {
      const primaryQuotes = await this.primaryProvider.getPrice(normalizedSymbols);
      
      primaryQuotes.forEach((quote, index) => {
        if (quote) {
          results.set(normalizedSymbols[index], quote);
        }
      });
      
      missingSymbols = normalizedSymbols.filter(s => !results.has(s));
      
      if (missingSymbols.length > 0) {
        console.log('[Aggregator] Missing from primary:', missingSymbols.join(', '));
      }
    } catch (primaryError) {
      console.warn('[Aggregator] Primary provider failed:', primaryError);
    }

    // Step 2: Try secondary provider (CryptoPrices.cc) for missing symbols
    if (missingSymbols.length > 0) {
      try {
        const secondaryQuotes = await this.secondaryProvider.getPrice(missingSymbols);
        
        secondaryQuotes.forEach((quote, index) => {
          if (quote) {
            results.set(missingSymbols[index], quote);
          }
        });
        
        missingSymbols = normalizedSymbols.filter(s => !results.has(s));
        
        if (missingSymbols.length > 0) {
          console.log('[Aggregator] Missing from secondary:', missingSymbols.join(', '));
        }
      } catch (secondaryError) {
        console.warn('[Aggregator] Secondary provider failed:', secondaryError);
      }
    }

    // Step 3: Try fallback provider (CoinGecko) for still missing symbols
    if (missingSymbols.length > 0) {
      try {
        const fallbackQuotes = await this.fallbackProvider.getPrice(missingSymbols);
        
        fallbackQuotes.forEach((quote, index) => {
          if (quote) {
            results.set(missingSymbols[index], quote);
          }
        });
        
        missingSymbols = normalizedSymbols.filter(s => !results.has(s));
        
        if (missingSymbols.length > 0) {
          console.log('[Aggregator] Still missing after all providers:', missingSymbols.join(', '));
        }
      } catch (fallbackError) {
        console.warn('[Aggregator] Fallback provider failed:', fallbackError);
      }
    }

    // Step 4: Fill in any remaining missing symbols with stale data or zeros
    for (const symbol of normalizedSymbols) {
      if (!results.has(symbol)) {
        const lastKnown = this.lastKnownQuotes.get(symbol);
        if (lastKnown) {
          results.set(symbol, { ...lastKnown, stale: true });
        } else {
          results.set(symbol, {
            symbol,
            priceUsd: 0,
            marketCapUsd: 0,
            timestamp: Date.now(),
            stale: true,
          });
        }
      }
    }

    // Check for significant changes and update cache
    const finalQuotes = normalizedSymbols.map(symbol => {
      const quote = results.get(symbol)!;
      const lastKnown = this.lastKnownQuotes.get(symbol);
      
      if (lastKnown && !quote.stale && quote.priceUsd > 0) {
        this.checkSignificantChange(lastKnown, quote);
      }
      
      if (!quote.stale && quote.priceUsd > 0) {
        this.lastKnownQuotes.set(symbol, quote);
      }
      
      return quote;
    });

    return finalQuotes;
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    const quotes = await this.getPrice([symbol]);
    return quotes[0]?.priceUsd || 0;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalAggregator: PriceAggregator | null = null;

export function getPriceAggregator(useMock: boolean = false): PriceAggregator {
  if (!globalAggregator) {
    globalAggregator = new PriceAggregator(useMock);
  }
  return globalAggregator;
}

export function resetGlobalAggregator(): void {
  globalAggregator = null;
}
