/**
 * CoinGecko Provider
 * 
 * Fetches market data and registry information from CoinGecko API.
 * Used for logo URLs and stable coin IDs.
 */

import { CoinGeckoCoin, Registry, RegistryEntry } from '../types';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const FETCH_TIMEOUT_MS = 15000;

/**
 * Fetch coins from CoinGecko /coins/markets endpoint
 */
export async function fetchCoinGeckoMarkets(
  page: number = 1,
  perPage: number = 250
): Promise<CoinGeckoCoin[]> {
  const url = new URL(`${COINGECKO_BASE_URL}/coins/markets`);
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('order', 'market_cap_desc');
  url.searchParams.set('per_page', perPage.toString());
  url.searchParams.set('page', page.toString());
  url.searchParams.set('sparkline', 'false');
  
  console.log(`[CoinGecko] Fetching page ${page}: ${url.toString()}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'YSL-Price-Cache/1.0'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Handle rate limiting
      if (response.status === 429) {
        throw new Error('CoinGecko API rate limit exceeded');
      }
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as CoinGeckoCoin[];
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid response from CoinGecko API');
    }
    
    console.log(`[CoinGecko] Fetched ${data.length} coins from page ${page}`);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('CoinGecko API request timed out');
    }
    throw error;
  }
}

/**
 * Build a registry from CoinGecko data
 */
export function buildRegistry(coins: CoinGeckoCoin[]): Registry {
  const now = new Date().toISOString();
  const byId: Record<string, RegistryEntry> = {};
  const symbolToIds: Record<string, string[]> = {};
  
  for (const coin of coins) {
    const symbol = (coin.symbol || '').toUpperCase();
    const id = coin.id;
    
    if (!symbol || !id) continue;
    
    // Add to byId
    byId[id] = {
      id,
      symbol,
      name: coin.name || symbol,
      logoUrl: coin.image || '',
      marketCapRank: coin.market_cap_rank || 0,
      firstSeenAt: now,
      lastSeenAt: now
    };
    
    // Add to symbolToIds mapping
    if (!symbolToIds[symbol]) {
      symbolToIds[symbol] = [];
    }
    if (!symbolToIds[symbol].includes(id)) {
      symbolToIds[symbol].push(id);
    }
  }
  
  return {
    source: 'coingecko',
    updatedAt: now,
    count: Object.keys(byId).length,
    byId,
    symbolToIds
  };
}

/**
 * Merge new registry data into existing registry (append-only)
 * - Never delete entries from byId
 * - Update lastSeenAt when coin appears again
 * - Keep symbolToIds as lists to handle collisions
 */
export function mergeRegistry(existing: Registry, newData: Registry): Registry {
  const now = new Date().toISOString();
  const mergedById: Record<string, RegistryEntry> = { ...existing.byId };
  const mergedSymbolToIds: Record<string, string[]> = { ...existing.symbolToIds };
  
  // Process new entries
  for (const [id, entry] of Object.entries(newData.byId)) {
    if (mergedById[id]) {
      // Update existing entry (preserve firstSeenAt)
      mergedById[id] = {
        ...entry,
        firstSeenAt: mergedById[id].firstSeenAt,
        lastSeenAt: now
      };
    } else {
      // New entry
      mergedById[id] = {
        ...entry,
        firstSeenAt: now,
        lastSeenAt: now
      };
    }
  }
  
  // Merge symbolToIds
  for (const [symbol, ids] of Object.entries(newData.symbolToIds)) {
    if (!mergedSymbolToIds[symbol]) {
      mergedSymbolToIds[symbol] = [];
    }
    for (const id of ids) {
      if (!mergedSymbolToIds[symbol].includes(id)) {
        mergedSymbolToIds[symbol].push(id);
      }
    }
  }
  
  return {
    source: 'coingecko',
    updatedAt: now,
    count: Object.keys(mergedById).length,
    byId: mergedById,
    symbolToIds: mergedSymbolToIds
  };
}
