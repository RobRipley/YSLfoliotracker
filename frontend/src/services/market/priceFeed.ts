/**
 * Price Feed Service
 * 
 * Client for the YSL Price Cache Cloudflare Worker.
 * Provides access to cached price data and token registry.
 */

// Types matching the Worker's response format
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
  source: string;
  updatedAt: string;
  count: number;
  bySymbol: Record<string, NormalizedCoin>;
}

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
  source: string;
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

// Get the Worker URL from environment variable
function getWorkerBaseUrl(): string {
  const url = import.meta.env.VITE_PRICE_CACHE_URL;
  if (!url) {
    throw new Error('VITE_PRICE_CACHE_URL environment variable is not set');
  }
  return url.replace(/\/$/, ''); // Remove trailing slash if present
}

/**
 * Fetch the top 500 prices from the Worker cache
 */
export async function fetchPricesTop500(): Promise<NormalizedPrices> {
  const baseUrl = getWorkerBaseUrl();
  const response = await fetch(`${baseUrl}/prices/top500.json`);
  
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Price data not yet available. Worker cron has not run yet.');
    }
    throw new Error(`Worker API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch the token registry (logos, CoinGecko IDs)
 */
export async function fetchRegistry(): Promise<Registry> {
  const baseUrl = getWorkerBaseUrl();
  const response = await fetch(`${baseUrl}/registry/latest.json`);
  
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Registry not yet available. Daily cron has not run yet.');
    }
    throw new Error(`Worker API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get price status from the Worker
 */
export async function fetchPriceStatus(): Promise<PriceStatus> {
  const baseUrl = getWorkerBaseUrl();
  const response = await fetch(`${baseUrl}/prices/status.json`);
  
  if (!response.ok) {
    throw new Error(`Worker API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get logo URL for a symbol from the registry
 */
export function getLogoUrl(registry: Registry, symbol: string): string | null {
  const upperSymbol = symbol.toUpperCase();
  const ids = registry.symbolToIds[upperSymbol];
  
  if (!ids || ids.length === 0) {
    return null;
  }
  
  const entry = registry.byId[ids[0]];
  return entry?.logoUrl || null;
}

/**
 * Check Worker health
 */
export async function checkWorkerHealth(): Promise<boolean> {
  try {
    const baseUrl = getWorkerBaseUrl();
    const response = await fetch(`${baseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
