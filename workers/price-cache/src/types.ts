/**
 * Type definitions for YSL Price Cache Worker
 * 
 * Data Storage Architecture:
 * 
 * KV (Hot Cache - Real-time Access):
 * - prices:top500:latest      - Current price data blob WITH EMBEDDED STATUS (written every 5 min)
 *                               Contains: prices + lastFetchOk + lastFetchError + timestamps + dataHash
 * - registry:coingecko:latest - Mirror of registry for fast reads (written daily)
 * 
 * ⚠️ REMOVED (Jan 2026 KV Limit Fix):
 * - prices:top500:status      - REMOVED - status now embedded in prices:top500:latest
 * 
 * R2 (Cold Storage - Historical Snapshots):
 * - prices/top500/YYYY-MM-DD.json          - Daily price snapshots
 * - registry/coingecko_registry.json       - Master append-only registry (source of truth)
 * - registry/top500_snapshot/YYYY-MM-DD.json - Daily top 500 composition
 * 
 * KV Write Budget (Free Tier: 1,000 writes/day):
 * - 5-minute refresh: 1 write per run (or 0 if unchanged) × 288 runs = ≤288 writes
 * - Daily cron: 1 write (registry mirror to KV) = 1 write
 * - Total estimate: ≤289 writes/day (~29% of free tier)
 * 
 * Optimization: Skip-if-unchanged (djb2 hash comparison)
 * - Computes hash of price data before write
 * - Skips KV write if hash matches previous blob
 * - Typically reduces daily writes significantly
 */

// Cloudflare Worker Environment bindings
export interface Env {
  // KV namespace for hot cache (real-time access)
  PRICE_KV: KVNamespace;
  
  // R2 bucket for historical snapshots (daily persistence)
  // This SHOULD be defined for full functionality.
  // If undefined, daily snapshot writes will fail with clear error.
  PRICE_R2?: R2Bucket;
  
  // Environment variables
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

// Registry data structure (append-only, stored in R2)
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
  lastSuccess?: string;  // ISO timestamp of last successful refresh
  r2Enabled?: boolean;   // Whether R2 is configured
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
  snapshotDate: string;  // YYYY-MM-DD
  snapshotTimestamp: string;  // Full ISO timestamp
  source: 'cryptorates.ai';
  updatedAt: string;
  count: number;
  bySymbol: Record<string, NormalizedCoin>;
}

export interface SnapshotEntry {
  id: string;
  symbol: string;
  rank: number;
}
