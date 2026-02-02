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
import { 
  isWorkerCacheConfigured, 
  fetchFromWorkerCache, 
  fetchLogosFromWorkerCache,
  getWorkerCacheStatus 
} from './workerCacheProvider';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ExtendedPriceQuote extends PriceQuote {
  marketCapUsd?: number;
  volume24h?: number;
  change24h?: number;
  stale?: boolean;
  logoUrl?: string;  // Token logo URL
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
// COINGECKO ID AUTO-DISCOVERY SYSTEM
// ============================================================================

/**
 * CoinGecko Coin List Manager
 * 
 * Automatically fetches and caches the full CoinGecko coins list (/coins/list)
 * to dynamically resolve symbol -> CoinGecko ID mappings without hardcoding.
 * 
 * Strategy:
 * 1. On first use, fetch full coins list from CoinGecko (15,000+ coins)
 * 2. Cache in localStorage for 24 hours
 * 3. Build symbol -> ID map dynamically
 * 4. Use hardcoded overrides for known edge cases (multiple coins same symbol)
 * 5. Log unknown symbols for easy debugging
 */

interface CoinGeckoCoinListItem {
  id: string;
  symbol: string;
  name: string;
}

class CoinGeckoIdResolver {
  private readonly localStorageKey = 'coingecko_coins_list';
  private readonly localStorageTimestampKey = 'coingecko_coins_list_timestamp';
  private readonly cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
  
  private symbolToIdMap: Map<string, string> = new Map();
  private idToSymbolMap: Map<string, string> = new Map();
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  
  // Hardcoded overrides for symbols with multiple coins (pick the most popular)
  // These take precedence over the auto-discovered mappings
  private readonly symbolOverrides: Record<string, string> = {
    // Major coins (ensure correct ID for common symbols)
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'SOL': 'solana',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'AVAX': 'avalanche-2',
    'DOT': 'polkadot',
    'MATIC': 'matic-network',
    'ATOM': 'cosmos',
    
    // Tokens with multiple matches - specify correct one
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'AAVE': 'aave',
    'RENDER': 'render-token',
    'ONDO': 'ondo-finance',
    'FIL': 'filecoin',
    'SUI': 'sui',
    'NEAR': 'near',
    'ICP': 'internet-computer',
    'HYPE': 'hyperliquid',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'ENA': 'ethena',
    'RSR': 'reserve-rights',
    'KMNO': 'kamino',
    'DEEP': 'deepbook',
    'SYRUP': 'maple-finance',
    'W': 'wormhole',
    'JUP': 'jupiter-exchange-solana',
    'SHIB': 'shiba-inu',
    'DOGE': 'dogecoin',
  };
  
  constructor() {
    // Initialize asynchronously
    this.initPromise = this.initialize();
  }
  
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Try to load from localStorage first
    if (this.loadFromLocalStorage()) {
      this.initialized = true;
      console.log(`[CoinGecko ID Resolver] Loaded ${this.symbolToIdMap.size} symbols from cache`);
      return;
    }
    
    // Fetch fresh data
    await this.fetchAndCacheCoins();
    this.initialized = true;
  }
  
  private loadFromLocalStorage(): boolean {
    try {
      const cached = localStorage.getItem(this.localStorageKey);
      const timestamp = localStorage.getItem(this.localStorageTimestampKey);
      
      if (cached && timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        if (age < this.cacheTTL) {
          const data: CoinGeckoCoinListItem[] = JSON.parse(cached);
          this.buildMapsFromData(data);
          return true;
        }
      }
    } catch (error) {
      console.warn('[CoinGecko ID Resolver] Failed to load from localStorage:', error);
    }
    return false;
  }
  
  private async fetchAndCacheCoins(): Promise<void> {
    try {
      console.log('[CoinGecko ID Resolver] Fetching full coins list...');
      const response = await fetch('https://api.coingecko.com/api/v3/coins/list');
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      
      const data: CoinGeckoCoinListItem[] = await response.json();
      console.log(`[CoinGecko ID Resolver] Fetched ${data.length} coins from CoinGecko`);
      
      // Build maps
      this.buildMapsFromData(data);
      
      // Cache in localStorage
      localStorage.setItem(this.localStorageKey, JSON.stringify(data));
      localStorage.setItem(this.localStorageTimestampKey, Date.now().toString());
      
    } catch (error) {
      console.error('[CoinGecko ID Resolver] Failed to fetch coins list:', error);
      // Fall back to overrides only
      this.symbolToIdMap = new Map(Object.entries(this.symbolOverrides));
    }
  }
  
  private buildMapsFromData(data: CoinGeckoCoinListItem[]): void {
    this.symbolToIdMap.clear();
    this.idToSymbolMap.clear();
    
    // First pass: build maps from CoinGecko data
    // For duplicate symbols, we prefer shorter IDs (usually more popular coins)
    const symbolIdLengths: Map<string, number> = new Map();
    
    for (const coin of data) {
      const symbol = coin.symbol.toUpperCase();
      const existingIdLength = symbolIdLengths.get(symbol);
      
      // If no existing mapping, or this ID is shorter (likely more popular), use it
      if (!existingIdLength || coin.id.length < existingIdLength) {
        this.symbolToIdMap.set(symbol, coin.id);
        symbolIdLengths.set(symbol, coin.id.length);
      }
      
      // Always map ID -> symbol (no conflicts possible)
      this.idToSymbolMap.set(coin.id, symbol);
    }
    
    // Second pass: apply hardcoded overrides (these take precedence)
    for (const [symbol, id] of Object.entries(this.symbolOverrides)) {
      this.symbolToIdMap.set(symbol, id);
    }
  }
  
  /**
   * Get CoinGecko ID for a symbol
   * Returns the ID or falls back to lowercase symbol
   */
  async getId(symbol: string): Promise<string> {
    await this.initPromise;
    
    const normalized = symbol.toUpperCase();
    const id = this.symbolToIdMap.get(normalized);
    
    if (id) {
      return id;
    }
    
    // Not found - log it and return lowercase symbol as fallback
    console.warn(`[CoinGecko ID Resolver] No ID found for symbol: ${normalized}. Using fallback: ${symbol.toLowerCase()}`);
    return symbol.toLowerCase();
  }
  
  /**
   * Get multiple IDs at once
   */
  async getIds(symbols: string[]): Promise<Map<string, string>> {
    await this.initPromise;
    
    const result = new Map<string, string>();
    for (const symbol of symbols) {
      const normalized = symbol.toUpperCase();
      const id = this.symbolToIdMap.get(normalized) || symbol.toLowerCase();
      result.set(normalized, id);
      
      if (!this.symbolToIdMap.has(normalized)) {
        console.warn(`[CoinGecko ID Resolver] Unknown symbol: ${normalized}`);
      }
    }
    return result;
  }
  
  /**
   * Get symbol from CoinGecko ID (reverse lookup)
   */
  async getSymbol(id: string): Promise<string | undefined> {
    await this.initPromise;
    return this.idToSymbolMap.get(id);
  }
  
  /**
   * Get all known symbol -> ID mappings
   */
  async getAllMappings(): Promise<Record<string, string>> {
    await this.initPromise;
    return Object.fromEntries(this.symbolToIdMap);
  }
  
  /**
   * Force refresh the coins list cache
   */
  async refresh(): Promise<void> {
    localStorage.removeItem(this.localStorageKey);
    localStorage.removeItem(this.localStorageTimestampKey);
    this.initialized = false;
    this.initPromise = this.initialize();
    await this.initPromise;
  }
}

// Singleton instance
const coinGeckoIdResolver = new CoinGeckoIdResolver();

// Export for debugging/manual refresh
export { coinGeckoIdResolver };

// ============================================================================
// COINGECKO PROVIDER (Last Resort Fallback)
// ============================================================================

class CoinGeckoProvider {
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private readonly idResolver = coinGeckoIdResolver;

  async getPrice(symbols: string[]): Promise<(ExtendedPriceQuote | null)[]> {
    // Get symbol -> ID mappings using the auto-discovery resolver
    const symbolToIdMap = await this.idResolver.getIds(symbols);
    
    // Convert to comma-separated IDs
    const ids = Array.from(symbolToIdMap.values()).join(',');
    
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
      const id = symbolToIdMap.get(normalizedSymbol) || symbol.toLowerCase();
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

  /**
   * Fetch logos for symbols using CoinGecko /coins/markets endpoint
   * Returns a map of symbol -> logoUrl
   */
  async getLogos(symbols: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    
    // Get symbol -> ID mappings using the auto-discovery resolver
    const symbolToIdMap = await this.idResolver.getIds(symbols);
    
    // Convert to comma-separated IDs
    const ids = Array.from(symbolToIdMap.values()).join(',');
    
    if (!ids) return result;

    try {
      const response = await fetch(
        `${this.baseUrl}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false`
      );

      if (!response.ok) {
        console.warn(`[CoinGecko] Logos fetch failed: ${response.status}`);
        return result;
      }

      const data = await response.json();
      
      // Build reverse map: CoinGecko ID -> original symbol
      const idToSymbol: Record<string, string> = {};
      for (const [sym, id] of symbolToIdMap.entries()) {
        idToSymbol[id] = sym;
      }

      for (const coin of data) {
        const symbol = idToSymbol[coin.id] || coin.symbol?.toUpperCase();
        if (symbol && coin.image) {
          result[symbol] = coin.image;
        }
      }

      console.log(`[CoinGecko] Fetched logos for ${Object.keys(result).length} symbols`);
    } catch (error) {
      console.warn('[CoinGecko] Error fetching logos:', error);
    }

    return result;
  }

  // Expose method to get symbol->ID mappings for debugging
  async getSymbolToId(): Promise<Record<string, string>> {
    return this.idResolver.getAllMappings();
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
   * 0. Try Worker Cache first (if configured)
   * 1. Try CryptoRates.ai for all symbols (has market cap)
   * 2. For missing symbols, try CryptoPrices.cc (price only)
   * 3. For symbols with price but no market cap, supplement from CoinGecko
   * 4. For still missing, try CoinGecko for full data
   * 5. Return stale data or zeros for anything still missing
   */
  async getPrice(symbols: string[]): Promise<ExtendedPriceQuote[]> {
    const normalizedSymbols = symbols.map(s => s.toUpperCase());
    const results: Map<string, ExtendedPriceQuote> = new Map();
    let missingSymbols: string[] = [...normalizedSymbols];

    // Step 0: Try Worker Cache first (if configured)
    if (isWorkerCacheConfigured()) {
      try {
        console.log('[Aggregator] Trying Worker cache first...');
        const workerQuotes = await fetchFromWorkerCache(normalizedSymbols);
        
        workerQuotes.forEach((quote, index) => {
          if (quote && quote.priceUsd > 0) {
            results.set(normalizedSymbols[index], quote);
          }
        });
        
        missingSymbols = normalizedSymbols.filter(s => !results.has(s));
        
        if (results.size > 0) {
          console.log(`[Aggregator] Got ${results.size} prices from Worker cache`);
        }
        
        if (missingSymbols.length === 0) {
          // Worker cache had all symbols, skip other providers
          return this.finalizeResults(normalizedSymbols, results);
        }
        
        if (missingSymbols.length > 0) {
          console.log('[Aggregator] Missing from Worker cache:', missingSymbols.join(', '));
        }
      } catch (workerError) {
        console.warn('[Aggregator] Worker cache failed:', workerError);
      }
    }

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

    // Step 3: Supplement missing market cap data from CoinGecko
    // Find symbols that have price but no market cap
    const symbolsNeedingMarketCap = normalizedSymbols.filter(s => {
      const quote = results.get(s);
      return quote && quote.priceUsd > 0 && (!quote.marketCapUsd || quote.marketCapUsd === 0);
    });

    if (symbolsNeedingMarketCap.length > 0) {
      console.log('[Aggregator] Fetching market cap from CoinGecko for:', symbolsNeedingMarketCap.join(', '));
      try {
        const marketCapQuotes = await this.fallbackProvider.getPrice(symbolsNeedingMarketCap);
        
        marketCapQuotes.forEach((geckoQuote, index) => {
          const symbol = symbolsNeedingMarketCap[index];
          const existingQuote = results.get(symbol);
          
          if (geckoQuote && geckoQuote.marketCapUsd && existingQuote) {
            // Merge: keep existing price, add market cap from CoinGecko
            results.set(symbol, {
              ...existingQuote,
              marketCapUsd: geckoQuote.marketCapUsd,
            });
            console.log(`[Aggregator] Added market cap for ${symbol}: $${(geckoQuote.marketCapUsd / 1e9).toFixed(2)}B`);
          }
        });
      } catch (marketCapError) {
        console.warn('[Aggregator] Failed to fetch market cap supplement:', marketCapError);
      }
    }

    // Step 4: Try fallback provider (CoinGecko) for still completely missing symbols
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

    // Step 5: Fill in any remaining missing symbols with stale data or zeros
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

    return this.finalizeResults(normalizedSymbols, results);
  }

  /**
   * Finalize results: check for changes, update cache, and return quotes
   */
  private finalizeResults(normalizedSymbols: string[], results: Map<string, ExtendedPriceQuote>): ExtendedPriceQuote[] {
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

  /**
   * Fetch logos for given symbols
   * Tries Worker cache first (if configured), falls back to CoinGecko
   */
  async getLogos(symbols: string[]): Promise<Record<string, string>> {
    // Try Worker cache first if configured
    if (isWorkerCacheConfigured()) {
      try {
        const workerLogos = await fetchLogosFromWorkerCache(symbols);
        if (Object.keys(workerLogos).length > 0) {
          console.log(`[Aggregator] Got ${Object.keys(workerLogos).length} logos from Worker cache`);
          return workerLogos;
        }
      } catch (error) {
        console.warn('[Aggregator] Worker cache logos failed:', error);
      }
    }
    
    // Fall back to CoinGecko
    return this.fallbackProvider.getLogos(symbols);
  }

  /**
   * Fetch logos using CoinGecko IDs directly (more reliable than symbol lookup)
   * symbolToIdMap: Maps symbol -> CoinGecko ID for holdings that have stored IDs
   */
  async getLogosWithIds(symbolToIdMap: Record<string, string>): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const ids = Object.values(symbolToIdMap).filter(Boolean);
    
    if (ids.length === 0) {
      console.log('[Aggregator] No CoinGecko IDs provided for logo fetch');
      return result;
    }
    
    console.log(`[Aggregator] Fetching logos for ${ids.length} CoinGecko IDs:`, ids.join(', '));
    
    try {
      const idsParam = ids.join(',');
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsParam}&order=market_cap_desc&sparkline=false`
      );
      
      if (!response.ok) {
        console.warn(`[Aggregator] CoinGecko markets API error: ${response.status}`);
        return result;
      }
      
      const data = await response.json();
      
      // Build reverse map: CoinGecko ID -> symbol
      const idToSymbol: Record<string, string> = {};
      for (const [symbol, id] of Object.entries(symbolToIdMap)) {
        if (id) idToSymbol[id] = symbol;
      }
      
      for (const coin of data) {
        const symbol = idToSymbol[coin.id];
        if (symbol && coin.image) {
          result[symbol] = coin.image;
          console.log(`[Aggregator] Got logo for ${symbol} (${coin.id}): ${coin.image.substring(0, 50)}...`);
        }
      }
      
      console.log(`[Aggregator] Fetched ${Object.keys(result).length} logos via CoinGecko IDs`);
    } catch (error) {
      console.error('[Aggregator] Error fetching logos with IDs:', error);
    }
    
    return result;
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
