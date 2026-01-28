/**
 * Type definitions for YSL Price Cache Worker
 */

// Cloudflare Worker Environment bindings
export interface Env {
  PRICE_KV: KVNamespace;
  PRICE_R2: R2Bucket;
  COINGECKO_API_URL: string;
  CRYPTORATES_API_URL: string;
}

// Normalized price data structure
export interface NormalizedPrices {
  source: 'cryptorates.ai';
  updatedAt: string;
  count: number;
  bySymbol: Record<string, NormalizedCoin>;
}

export interface NormalizedCoin {
  symbol: string;
  name: string;
  rank: number;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  change24hPct: number;
}

// Registry data structure (append-only)
export interface Registry {
  source: 'coingecko';
  updatedAt: string;
  count: number;
  byId: Record<string, RegistryEntry>;
  symbolToIds: Record<string, string[]>;
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

// Price status for monitoring
export interface PriceStatus {
  success: boolean;
  count?: number;
  error?: string;
  timestamp: string;
  trigger: string;
}

// CryptoRates.ai API response types
export interface CryptoRatesResponse {
  coins?: CryptoRatesCoin[];
  data?: CryptoRatesCoin[];
  [key: string]: unknown;
}

export interface CryptoRatesCoin {
  symbol: string;
  name: string;
  rank?: number;
  market_cap_rank?: number;
  price?: number;
  current_price?: number;
  price_usd?: number;
  market_cap?: number;
  market_cap_usd?: number;
  volume_24h?: number;
  total_volume?: number;
  volume_24h_usd?: number;
  change_24h?: number;
  price_change_percentage_24h?: number;
  change_24h_pct?: number;
  [key: string]: unknown;
}

// CoinGecko API response types
export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  market_cap_rank: number;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
}

// Daily snapshot types
export interface DailySnapshot {
  date: string;
  ids: SnapshotEntry[];
}

export interface SnapshotEntry {
  id: string;
  symbol: string;
  rank: number;
}
