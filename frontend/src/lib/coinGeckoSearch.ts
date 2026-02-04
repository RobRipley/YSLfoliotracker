/**
 * CoinGecko Search & Disambiguation Service
 * 
 * Provides search functionality for finding the correct CoinGecko coin ID
 * when a user enters a symbol. Handles disambiguation when multiple coins
 * share the same ticker symbol.
 */

// Known symbol → CoinGecko ID mappings for problematic/ambiguous coins
// These override any search results to ensure correct resolution
export const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  // Explicitly mapped coins that have had issues
  'PAYAI': 'payai-network',
  'UMBRA': 'umbra',  // The main Umbra token
  
  // Major coins (ensure correct ID)
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'ATOM': 'cosmos',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'ICP': 'internet-computer',
  'SUI': 'sui',
  'NEAR': 'near',
  
  // Tokens with multiple matches - specify correct one
  'RENDER': 'render-token',
  'ONDO': 'ondo-finance',
  'FIL': 'filecoin',
  'HYPE': 'hyperliquid',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'ENA': 'ethena',
  'RSR': 'reserve-rights-token',
  'KMNO': 'kamino',
  'DEEP': 'deepbook',
  'SYRUP': 'syrup',
  'W': 'wormhole',
  'JUP': 'jupiter-exchange-solana',
  'SHIB': 'shiba-inu',
  'DOGE': 'dogecoin',
  'DRIFT': 'drift-protocol',
  
  // Stablecoins
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'DAI': 'dai',
  'BUSD': 'binance-usd',
};

export interface CoinGeckoSearchResult {
  id: string;
  symbol: string;
  name: string;
  thumb?: string;       // Small logo
  large?: string;       // Large logo
  market_cap_rank?: number;
  platforms?: Record<string, string>;  // Chain -> contract address
}

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
}

// Cache for search results
const searchCache = new Map<string, { results: CoinGeckoSearchResult[]; timestamp: number }>();
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Search CoinGecko for coins matching a query
 * Returns multiple results if the symbol is ambiguous
 */
export async function searchCoinGecko(query: string): Promise<CoinGeckoSearchResult[]> {
  const normalizedQuery = query.toUpperCase().trim();
  
  // Check if we have an explicit mapping
  const explicitId = SYMBOL_TO_COINGECKO_ID[normalizedQuery];
  if (explicitId) {
    console.log(`[CoinGecko Search] Using explicit mapping: ${normalizedQuery} -> ${explicitId}`);
    // Fetch the coin details to get logo
    try {
      const coin = await fetchCoinById(explicitId);
      if (coin) {
        return [{
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          large: coin.image?.large || coin.image?.small,
          thumb: coin.image?.thumb || coin.image?.small,
          market_cap_rank: coin.market_cap_rank,
        }];
      }
    } catch (e) {
      console.warn(`[CoinGecko Search] Failed to fetch explicit mapping ${explicitId}:`, e);
    }
  }
  
  // Check cache
  const cached = searchCache.get(normalizedQuery);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    console.log(`[CoinGecko Search] Using cached results for "${normalizedQuery}"`);
    return cached.results;
  }
  
  console.log(`[CoinGecko Search] Searching for "${normalizedQuery}"...`);
  
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko search API error: ${response.status}`);
    }
    
    const data = await response.json();
    const coins: CoinGeckoSearchResult[] = data.coins || [];
    
    // Filter to exact symbol matches first, then partial matches
    const exactMatches = coins.filter(c => c.symbol.toUpperCase() === normalizedQuery);
    const results = exactMatches.length > 0 ? exactMatches : coins.slice(0, 10);
    
    console.log(`[CoinGecko Search] Found ${results.length} results for "${normalizedQuery}"`);
    
    // Cache results
    searchCache.set(normalizedQuery, { results, timestamp: Date.now() });
    
    return results;
  } catch (error) {
    console.error('[CoinGecko Search] Error:', error);
    return [];
  }
}

/**
 * Fetch a specific coin by CoinGecko ID
 */
export async function fetchCoinById(coinId: string): Promise<any | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[CoinGecko] Coin not found: ${coinId}`);
        return null;
      }
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[CoinGecko] Failed to fetch coin ${coinId}:`, error);
    return null;
  }
}

/**
 * Fetch logo URL for a coin by its CoinGecko ID
 * Returns the large image URL if available
 */
export async function fetchLogoByCoingeckoId(coinId: string): Promise<string | null> {
  try {
    const coin = await fetchCoinById(coinId);
    if (coin?.image) {
      return coin.image.large || coin.image.small || coin.image.thumb || null;
    }
    return null;
  } catch (error) {
    console.error(`[CoinGecko] Failed to fetch logo for ${coinId}:`, error);
    return null;
  }
}

/**
 * Check if a symbol has multiple possible CoinGecko matches
 * Used to determine if disambiguation UI is needed
 */
export async function isAmbiguousSymbol(symbol: string): Promise<boolean> {
  const normalizedSymbol = symbol.toUpperCase().trim();
  
  // If we have an explicit mapping, it's not ambiguous
  if (SYMBOL_TO_COINGECKO_ID[normalizedSymbol]) {
    return false;
  }
  
  const results = await searchCoinGecko(symbol);
  
  // Ambiguous if there are multiple exact symbol matches
  const exactMatches = results.filter(r => r.symbol.toUpperCase() === normalizedSymbol);
  return exactMatches.length > 1;
}

/**
 * Get the best CoinGecko ID for a symbol
 * Uses explicit mapping if available, otherwise returns the highest-ranked match
 */
export function getBestCoinGeckoId(symbol: string, searchResults?: CoinGeckoSearchResult[]): string | null {
  const normalizedSymbol = symbol.toUpperCase().trim();
  
  // Check explicit mapping first
  const explicitId = SYMBOL_TO_COINGECKO_ID[normalizedSymbol];
  if (explicitId) {
    return explicitId;
  }
  
  // If we have search results, use the highest-ranked exact match
  if (searchResults && searchResults.length > 0) {
    const exactMatches = searchResults.filter(r => r.symbol.toUpperCase() === normalizedSymbol);
    if (exactMatches.length > 0) {
      // Sort by market cap rank (lower is better)
      exactMatches.sort((a, b) => (a.market_cap_rank || 9999) - (b.market_cap_rank || 9999));
      return exactMatches[0].id;
    }
    // Fallback to first result
    return searchResults[0].id;
  }
  
  // Fallback to lowercase symbol (CoinGecko convention)
  return normalizedSymbol.toLowerCase();
}

/**
 * Clear the search cache (useful for testing)
 */
export function clearSearchCache(): void {
  searchCache.clear();
  console.log('[CoinGecko Search] Cache cleared');
}
