/**
 * CryptoRates.ai Provider
 * 
 * Fetches price data from CryptoRates.ai API.
 * Primary source for real-time prices (free, no rate limits, no API keys).
 */

import { CryptoRatesCoin, CryptoRatesResponse, NormalizedPrices, NormalizedCoin } from '../types';

const CRYPTORATES_BASE_URL = 'https://cryptorates.ai/v1';
const FETCH_TIMEOUT_MS = 15000;

/**
 * Fetch top N coins from CryptoRates.ai
 */
export async function fetchCryptoRatesPrices(limit: number = 500): Promise<CryptoRatesCoin[]> {
  const url = `${CRYPTORATES_BASE_URL}/coins/${limit}`;
  
  console.log(`[CryptoRates] Fetching from: ${url}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'YSL-Price-Cache/1.0'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`CryptoRates API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as CryptoRatesResponse;
    
    // Handle different response formats
    const coins = data.coins || data.data || (Array.isArray(data) ? data : []);
    
    if (!Array.isArray(coins) || coins.length === 0) {
      throw new Error('Invalid or empty response from CryptoRates API');
    }
    
    console.log(`[CryptoRates] Fetched ${coins.length} coins`);
    return coins;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('CryptoRates API request timed out');
    }
    throw error;
  }
}

/**
 * Normalize CryptoRates data into our standard format
 */
export function normalizeCryptoRatesData(coins: CryptoRatesCoin[]): NormalizedPrices {
  const bySymbol: Record<string, NormalizedCoin> = {};
  
  let rank = 1;
  for (const coin of coins) {
    const symbol = (coin.symbol || '').toUpperCase();
    if (!symbol) continue;
    
    // Skip if we already have this symbol (keep first/higher ranked)
    if (bySymbol[symbol]) continue;
    
    // Extract price from various possible field names
    const priceUsd = extractNumber(coin, ['price', 'current_price', 'price_usd']);
    
    // Extract market cap
    const marketCapUsd = extractNumber(coin, ['market_cap', 'market_cap_usd']);
    
    // Extract 24h volume
    const volume24hUsd = extractNumber(coin, ['volume_24h', 'total_volume', 'volume_24h_usd']);
    
    // Extract 24h change percentage
    const change24hPct = extractNumber(coin, ['change_24h', 'price_change_percentage_24h', 'change_24h_pct']);
    
    // Extract rank
    const coinRank = coin.rank || coin.market_cap_rank || rank;
    
    bySymbol[symbol] = {
      symbol,
      name: coin.name || symbol,
      rank: coinRank,
      priceUsd,
      marketCapUsd,
      volume24hUsd,
      change24hPct
    };
    
    rank++;
  }
  
  return {
    source: 'cryptorates.ai',
    updatedAt: new Date().toISOString(),
    count: Object.keys(bySymbol).length,
    bySymbol
  };
}

/**
 * Extract a numeric value from an object, trying multiple possible field names
 */
function extractNumber(obj: Record<string, unknown>, fields: string[]): number {
  for (const field of fields) {
    const value = obj[field];
    if (value !== undefined && value !== null) {
      const num = typeof value === 'number' ? value : parseFloat(String(value));
      if (!isNaN(num)) {
        return num;
      }
    }
  }
  return 0;
}
