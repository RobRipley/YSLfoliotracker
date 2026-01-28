/**
 * Worker Cache Provider
 * 
 * Fetches price data from the YSL Price Cache Cloudflare Worker.
 * This is the preferred primary provider when the Worker is deployed and available.
 */

import { fetchPricesTop500, fetchRegistry, getLogoUrl, type NormalizedPrices, type Registry } from '../services/market/priceFeed';
import type { ExtendedPriceQuote } from './priceService';

// Cache the last successful fetch
let lastPricesData: NormalizedPrices | null = null;
let lastRegistryData: Registry | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Check if the Worker cache is available and configured
 */
export function isWorkerCacheConfigured(): boolean {
  // Check if environment variable is set
  const workerUrl = import.meta.env.VITE_PRICE_CACHE_URL;
  return !!workerUrl && workerUrl.length > 0 && !workerUrl.includes('YOUR-SUBDOMAIN');
}

/**
 * Fetch prices from Worker cache
 */
export async function fetchFromWorkerCache(symbols: string[]): Promise<(ExtendedPriceQuote | null)[]> {
  const now = Date.now();
  
  // Check if we need to refresh
  if (!lastPricesData || (now - lastFetchTime) > CACHE_TTL) {
    console.log('[WorkerCache] Fetching prices from Worker...');
    try {
      lastPricesData = await fetchPricesTop500();
      lastFetchTime = now;
      
      if (lastPricesData) {
        console.log(`[WorkerCache] Fetched ${lastPricesData.count} coins from Worker, updated at ${lastPricesData.updatedAt}`);
      }
    } catch (error) {
      console.warn('[WorkerCache] Failed to fetch from Worker:', error);
      // Continue with cached data if available
    }
  }
  
  if (!lastPricesData?.bySymbol) {
    console.warn('[WorkerCache] No price data available');
    return symbols.map(() => null);
  }
  
  // Map symbols to ExtendedPriceQuote format
  return symbols.map(symbol => {
    const upperSymbol = symbol.toUpperCase();
    const coinData = lastPricesData!.bySymbol[upperSymbol];
    
    if (!coinData) {
      return null;
    }
    
    return {
      symbol: upperSymbol,
      priceUsd: coinData.priceUsd,
      marketCapUsd: coinData.marketCapUsd,
      volume24h: coinData.volume24hUsd,
      change24h: coinData.change24hPct,
      timestamp: new Date(lastPricesData!.updatedAt).getTime(),
    };
  });
}

/**
 * Fetch logos from Worker cache registry
 */
export async function fetchLogosFromWorkerCache(symbols: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  
  // Refresh registry if needed
  if (!lastRegistryData) {
    try {
      lastRegistryData = await fetchRegistry();
      console.log(`[WorkerCache] Fetched registry with ${lastRegistryData?.count} entries`);
    } catch (error) {
      console.warn('[WorkerCache] Failed to fetch registry:', error);
      return result;
    }
  }
  
  if (!lastRegistryData) {
    return result;
  }
  
  for (const symbol of symbols) {
    const upperSymbol = symbol.toUpperCase();
    const ids = lastRegistryData.symbolToIds[upperSymbol];
    
    if (ids && ids.length > 0) {
      const entry = lastRegistryData.byId[ids[0]];
      if (entry?.logoUrl) {
        result[upperSymbol] = entry.logoUrl;
      }
    }
  }
  
  return result;
}

/**
 * Get CoinGecko ID from Worker cache registry
 */
export function getCoinGeckoIdFromCache(symbol: string): string | null {
  if (!lastRegistryData) return null;
  
  const upperSymbol = symbol.toUpperCase();
  const ids = lastRegistryData.symbolToIds[upperSymbol];
  
  return ids?.[0] || null;
}

/**
 * Clear the Worker cache (for testing/forced refresh)
 */
export function clearWorkerCache(): void {
  lastPricesData = null;
  lastRegistryData = null;
  lastFetchTime = 0;
  console.log('[WorkerCache] Cache cleared');
}

/**
 * Get Worker cache status
 */
export function getWorkerCacheStatus(): {
  configured: boolean;
  hasData: boolean;
  priceCount: number;
  registryCount: number;
  lastFetchTime: number;
  age: number;
} {
  return {
    configured: isWorkerCacheConfigured(),
    hasData: !!lastPricesData,
    priceCount: lastPricesData?.count || 0,
    registryCount: lastRegistryData?.count || 0,
    lastFetchTime,
    age: lastFetchTime ? Date.now() - lastFetchTime : -1,
  };
}
