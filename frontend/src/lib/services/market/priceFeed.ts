/**
 * Price Feed Service
 * 
 * Client module for fetching price and registry data from the YSL Price Cache Worker.
 * Provides cached access to cryptocurrency prices, logos, and identifiers.
 */

// Worker endpoint configuration
const WORKER_BASE_URL = import.meta.env.VITE_PRICE_CACHE_URL || 'https://ysl-price-cache.YOUR-SUBDOMAIN.workers.dev';

// Cache TTL in milliseconds
const PRICES_CACHE_TTL = 2 * 60 * 1000;  // 2 minutes
const REGISTRY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Normalized price data types
export interface NormalizedCoin {
  symbol: string;
  name: string;
  rank: number;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  change24hPct: number;
}

export interface NormalizedPrices {
  source: 'cryptorates.ai';
  updatedAt: string;
  count: number;
  bySymbol: Record<string, NormalizedCoin>;
}

// Registry types
export interface RegistryEntry {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string;
  marketCapRank: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface Registry {
  source: 'coingecko';
  updatedAt: string;
  count: number;
  byId: Record<string, RegistryEntry>;
  symbolToIds: Record<string, string[]>;
}

export interface PriceStatus {
  success: boolean;
  count?: number;
  error?: string;
  timestamp: string;
  trigger: string;
  updatedAt?: string;
  service: string;
}

// In-memory cache
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

let pricesCache: CacheEntry<NormalizedPrices> | null = null;
let registryCache: CacheEntry<Registry> | null = null;

/**
 * Fetch top 500 prices from the Worker cache
 * Returns normalized bySymbol map with in-memory caching
 */
export async function fetchPricesTop500(): Promise<NormalizedPrices | null> {
  // Check cache first
  if (pricesCache && (Date.now() - pricesCache.fetchedAt) < PRICES_CACHE_TTL) {
    console.log('[PriceFeed] Using cached prices');
    return pricesCache.data;
  }

  try {
    const url = `${WORKER_BASE_URL}/prices/top500.json`;
    console.log(`[PriceFeed] Fetching prices from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[PriceFeed] Failed to fetch prices: ${response.status}`);
      return pricesCache?.data || null;
    }

    const data = await response.json() as NormalizedPrices;
    
    // Update cache
    pricesCache = {
      data,
      fetchedAt: Date.now()
    };

    console.log(`[PriceFeed] Fetched ${data.count} prices, updated at ${data.updatedAt}`);
    return data;
  } catch (error) {
    console.error('[PriceFeed] Error fetching prices:', error);
    // Return stale cache on error
    return pricesCache?.data || null;
  }
}

/**
 * Fetch token registry from the Worker cache
 * Returns byId map and symbolToIds mapping
 */
export async function fetchRegistry(): Promise<Registry | null> {
  // Check cache first
  if (registryCache && (Date.now() - registryCache.fetchedAt) < REGISTRY_CACHE_TTL) {
    console.log('[PriceFeed] Using cached registry');
    return registryCache.data;
  }

  try {
    const url = `${WORKER_BASE_URL}/registry/latest.json`;
    console.log(`[PriceFeed] Fetching registry from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[PriceFeed] Failed to fetch registry: ${response.status}`);
      return registryCache?.data || null;
    }

    const data = await response.json() as Registry;
    
    // Update cache
    registryCache = {
      data,
      fetchedAt: Date.now()
    };

    console.log(`[PriceFeed] Fetched registry with ${data.count} entries`);
    return data;
  } catch (error) {
    console.error('[PriceFeed] Error fetching registry:', error);
    // Return stale cache on error
    return registryCache?.data || null;
  }
}

/**
 * Fetch price cache status
 */
export async function fetchPriceStatus(): Promise<PriceStatus | null> {
  try {
    const url = `${WORKER_BASE_URL}/prices/status.json`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    return await response.json() as PriceStatus;
  } catch (error) {
    console.error('[PriceFeed] Error fetching status:', error);
    return null;
  }
}

/**
 * Get price for a specific symbol from cache
 */
export function getPrice(symbol: string): NormalizedCoin | null {
  if (!pricesCache?.data?.bySymbol) return null;
  return pricesCache.data.bySymbol[symbol.toUpperCase()] || null;
}

/**
 * Get prices for multiple symbols from cache
 */
export function getPrices(symbols: string[]): Record<string, NormalizedCoin | null> {
  const result: Record<string, NormalizedCoin | null> = {};
  for (const symbol of symbols) {
    result[symbol] = getPrice(symbol);
  }
  return result;
}

/**
 * Get logo URL for a symbol from registry
 */
export function getLogoUrl(symbol: string): string | null {
  if (!registryCache?.data) return null;
  
  const upperSymbol = symbol.toUpperCase();
  const ids = registryCache.data.symbolToIds[upperSymbol];
  
  if (!ids || ids.length === 0) return null;
  
  // Use the first (most relevant) ID
  const entry = registryCache.data.byId[ids[0]];
  return entry?.logoUrl || null;
}

/**
 * Get logo URLs for multiple symbols
 */
export function getLogoUrls(symbols: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const symbol of symbols) {
    result[symbol] = getLogoUrl(symbol);
  }
  return result;
}

/**
 * Get CoinGecko ID for a symbol
 */
export function getCoinGeckoId(symbol: string): string | null {
  if (!registryCache?.data) return null;
  
  const upperSymbol = symbol.toUpperCase();
  const ids = registryCache.data.symbolToIds[upperSymbol];
  
  return ids?.[0] || null;
}

/**
 * Clear all caches (useful for testing or forced refresh)
 */
export function clearCache(): void {
  pricesCache = null;
  registryCache = null;
  console.log('[PriceFeed] Cache cleared');
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): {
  prices: { cached: boolean; age: number | null; count: number | null };
  registry: { cached: boolean; age: number | null; count: number | null };
} {
  return {
    prices: {
      cached: !!pricesCache,
      age: pricesCache ? Date.now() - pricesCache.fetchedAt : null,
      count: pricesCache?.data?.count || null
    },
    registry: {
      cached: !!registryCache,
      age: registryCache ? Date.now() - registryCache.fetchedAt : null,
      count: registryCache?.data?.count || null
    }
  };
}
