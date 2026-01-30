/**
 * YSL Price Cache Worker
 * 
 * Provides cached price data and token registry for the YSL Portfolio Tracker.
 * 
 * Architecture:
 * - KV: Hot cache for real-time access (single blob with embedded status)
 * - R2: Cold storage for historical snapshots (daily prices, master registry)
 * 
 * KV Write Budget (Free Tier: 1,000 writes/day):
 * - 5-minute refresh: 1 write (single blob) × 288 runs = 288 writes/day
 * - Daily cron: 1 write (registry KV mirror)
 * - Total estimate: ~289 writes/day (well under 1,000 limit)
 * 
 * ⚠️ KV LIMIT FIX (January 2026):
 * - BEFORE: 2 KV writes per refresh (latest + status) = 576 writes/day
 * - AFTER: 1 KV write per refresh (status embedded in latest blob) = 288 writes/day
 * - REMOVED: Separate prices:top500:status key
 * - Skip-if-unchanged: Computes hash, skips write if data identical
 * 
 * Cron Schedules:
 * - Every 5 min: Refresh prices from CryptoRates.ai → KV
 * - Daily 09:00 UTC: Write snapshot to R2, refresh CoinGecko registry
 * 
 * R2 Requirement:
 * - R2 is REQUIRED for daily snapshot functionality
 * - If R2 is not configured, daily cron will hard fail with clear error in status
 */

import { Env, NormalizedPrices, Registry, DailySnapshot } from './types';
import { fetchCryptoRatesPrices, normalizeCryptoRatesData } from './providers/cryptorates';
import { fetchCoinGeckoMarkets, buildRegistry, mergeRegistry } from './providers/coingecko';

// KV Keys - REDUCED from 2 to 1 for price data
const KV_PRICES_LATEST = 'prices:top500:latest';  // Contains prices + embedded status
// REMOVED: KV_PRICES_STATUS - now embedded in KV_PRICES_LATEST
const KV_REGISTRY_LATEST = 'registry:coingecko:latest';

// R2 Paths
const R2_PRICES_PREFIX = 'prices/top500';
const R2_REGISTRY_FILE = 'registry/coingecko_registry.json';
const R2_SNAPSHOT_PREFIX = 'registry/top500_snapshot';

// Type for unified price blob with embedded status
interface PricesWithStatus extends NormalizedPrices {
  // Status fields embedded directly
  lastFetchOk: boolean;
  lastFetchError?: string;
  lastFetchTimestamp: string;
  lastSuccessTimestamp?: string;
  fetchTrigger: string;
  r2Enabled: boolean;
  // Hash for skip-if-unchanged optimization
  dataHash?: string;
}

/**
 * Simple string hash for skip-if-unchanged optimization
 * Uses djb2 algorithm - fast and sufficient for change detection
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * HTTP Request Handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for cross-origin access from frontend
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route handling
      if (path === '/prices/top500.json') {
        return await handlePricesRequest(env, corsHeaders);
      }
      
      if (path === '/prices/status.json') {
        return await handleStatusRequest(env, corsHeaders);
      }
      
      if (path === '/registry/latest.json') {
        return await handleRegistryRequest(env, corsHeaders);
      }

      // Serve historical snapshot from R2
      const snapshotMatch = path.match(/^\/snapshots\/prices\/top500\/(\d{4}-\d{2}-\d{2})\.json$/);
      if (snapshotMatch) {
        return await handleSnapshotRequest(env, snapshotMatch[1], corsHeaders);
      }

      // Admin endpoints for manual triggers
      if (path === '/admin/refresh-prices') {
        ctx.waitUntil(refreshPrices(env, 'manual'));
        return jsonResponse({ status: 'started', message: 'Price refresh initiated' }, corsHeaders);
      }

      if (path === '/admin/refresh-registry') {
        ctx.waitUntil(refreshRegistry(env, 'manual'));
        return jsonResponse({ status: 'started', message: 'Registry refresh initiated' }, corsHeaders);
      }

      if (path === '/admin/write-snapshot') {
        ctx.waitUntil(writeDailySnapshot(env, 'manual'));
        return jsonResponse({ status: 'started', message: 'Snapshot write initiated' }, corsHeaders);
      }

      // Health check with R2 status
      if (path === '/health' || path === '/') {
        return jsonResponse({
          status: 'ok',
          service: 'ysl-price-cache',
          timestamp: new Date().toISOString(),
          r2Enabled: !!env.PRICE_R2,
          kvEnabled: !!env.PRICE_KV,
          kvWritesPerDay: '~289 (well under 1,000 free tier limit)'
        }, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Request error:', error);
      return jsonResponse({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, corsHeaders, 500);
    }
  },

  /**
   * Scheduled (Cron) Handler
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const trigger = event.cron;
    console.log(`[Cron] Triggered: ${trigger} at ${new Date().toISOString()}`);

    try {
      if (trigger === '*/5 * * * *') {
        // Every 5 minutes: Refresh prices to KV (1 write per run)
        await refreshPrices(env, 'scheduled');
      } else if (trigger === '0 9 * * *') {
        // Daily at 09:00 UTC: Write snapshot to R2 and refresh registry
        // R2 is REQUIRED for this cron - hard fail if not configured
        if (!env.PRICE_R2) {
          // Write error status to KV
          const errorBlob: PricesWithStatus = {
            source: 'cryptorates.ai',
            updatedAt: new Date().toISOString(),
            count: 0,
            bySymbol: {},
            lastFetchOk: false,
            lastFetchError: 'R2 disabled - daily snapshot skipped. Enable R2 in Cloudflare Dashboard.',
            lastFetchTimestamp: new Date().toISOString(),
            fetchTrigger: 'daily-snapshot',
            r2Enabled: false
          };
          await env.PRICE_KV.put(KV_PRICES_LATEST, JSON.stringify(errorBlob));
          console.error('[Daily] R2 is not configured! Daily snapshots require R2 bucket.');
          throw new Error('R2 is not configured. Daily snapshot requires R2 bucket "ysl-price-snapshots".');
        }
        
        await writeDailySnapshot(env, 'scheduled');
        await refreshRegistry(env, 'scheduled');
      }
    } catch (error) {
      console.error(`[Cron] Error during ${trigger}:`, error);
      // Status already embedded in KV blob
    }
  }
};

// Helper for JSON responses
function jsonResponse(data: unknown, corsHeaders: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * Refresh prices from CryptoRates.ai and store in KV
 * 
 * KV LIMIT FIX: Now writes only 1 key per refresh (was 2)
 * - Status is embedded directly in the price blob
 * - Skip-if-unchanged: Computes hash and skips write if data identical
 * 
 * KV Writes: 1 per call (or 0 if data unchanged)
 * At 288 calls/day (every 5 min), this is max 288 writes/day
 */
async function refreshPrices(env: Env, trigger: string): Promise<void> {
  console.log(`[Prices] Starting price refresh (trigger: ${trigger})...`);
  
  const now = new Date().toISOString();
  
  // Load previous blob to preserve lastSuccessTimestamp and check for changes
  let lastSuccessTimestamp: string | undefined;
  let previousHash: string | undefined;
  try {
    const prevBlobJson = await env.PRICE_KV.get(KV_PRICES_LATEST);
    if (prevBlobJson) {
      const prevBlob = JSON.parse(prevBlobJson) as PricesWithStatus;
      lastSuccessTimestamp = prevBlob.lastSuccessTimestamp;
      previousHash = prevBlob.dataHash;
    }
  } catch (e) {
    // Ignore parse errors on existing data
  }
  
  try {
    // Fetch from CryptoRates.ai
    const coins = await fetchCryptoRatesPrices(500);
    
    // Normalize the data
    const normalized = normalizeCryptoRatesData(coins);
    
    // Compute hash of price data for skip-if-unchanged optimization
    const priceDataString = JSON.stringify(normalized.bySymbol);
    const currentHash = simpleHash(priceDataString);
    
    // Check if data has changed
    if (previousHash && currentHash === previousHash) {
      console.log(`[Prices] Data unchanged (hash: ${currentHash}), skipping KV write`);
      return;
    }
    
    // Build unified blob with embedded status
    const blob: PricesWithStatus = {
      ...normalized,
      lastFetchOk: true,
      lastFetchTimestamp: now,
      lastSuccessTimestamp: now,  // Update on success
      fetchTrigger: trigger,
      r2Enabled: !!env.PRICE_R2,
      dataHash: currentHash
    };
    
    // KV Write: Store unified price blob (only 1 write!)
    await env.PRICE_KV.put(KV_PRICES_LATEST, JSON.stringify(blob));

    console.log(`[Prices] ✅ Refreshed ${normalized.count} coins (hash: ${currentHash}, 1 KV write)`);
  } catch (error) {
    console.error('[Prices] Failed to refresh:', error);
    
    // Write error status embedded in blob (preserve previous price data if available)
    let previousData: Partial<NormalizedPrices> = {
      source: 'cryptorates.ai',
      updatedAt: now,
      count: 0,
      bySymbol: {}
    };
    
    try {
      const prevBlobJson = await env.PRICE_KV.get(KV_PRICES_LATEST);
      if (prevBlobJson) {
        const prevBlob = JSON.parse(prevBlobJson) as PricesWithStatus;
        // Preserve previous price data on failure
        previousData = {
          source: prevBlob.source,
          updatedAt: prevBlob.updatedAt,
          count: prevBlob.count,
          bySymbol: prevBlob.bySymbol
        };
      }
    } catch (e) {
      // Use empty data if can't read previous
    }
    
    const errorBlob: PricesWithStatus = {
      source: previousData.source || 'cryptorates.ai',
      updatedAt: previousData.updatedAt || now,
      count: previousData.count || 0,
      bySymbol: previousData.bySymbol || {},
      lastFetchOk: false,
      lastFetchError: error instanceof Error ? error.message : 'Unknown error',
      lastFetchTimestamp: now,
      lastSuccessTimestamp,  // Preserve previous success time
      fetchTrigger: trigger,
      r2Enabled: !!env.PRICE_R2
    };
    await env.PRICE_KV.put(KV_PRICES_LATEST, JSON.stringify(errorBlob));
    
    throw error;
  }
}

/**
 * Write daily price snapshot to R2
 * R2 is REQUIRED - will throw if not configured
 */
async function writeDailySnapshot(env: Env, trigger: string): Promise<void> {
  if (!env.PRICE_R2) {
    throw new Error('R2 is not configured. Cannot write daily snapshot.');
  }
  
  console.log(`[Snapshot] Writing daily price snapshot (trigger: ${trigger})...`);
  
  // Get current prices from KV
  const blobJson = await env.PRICE_KV.get(KV_PRICES_LATEST);
  if (!blobJson) {
    console.warn('[Snapshot] No prices in KV to snapshot');
    return;
  }

  const blob = JSON.parse(blobJson) as PricesWithStatus;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `${R2_PRICES_PREFIX}/${today}.json`;
  
  // Add snapshot metadata (extract just the price data, not status fields)
  const snapshot: DailySnapshot = {
    snapshotDate: today,
    snapshotTimestamp: new Date().toISOString(),
    source: blob.source,
    updatedAt: blob.updatedAt,
    count: blob.count,
    bySymbol: blob.bySymbol
  };
  
  // Write to R2
  await env.PRICE_R2.put(key, JSON.stringify(snapshot), {
    httpMetadata: {
      contentType: 'application/json'
    }
  });

  console.log(`[Snapshot] Wrote daily snapshot: ${key}`);
}

/**
 * Refresh CoinGecko registry
 * - Master registry stored in R2 (append-only, source of truth)
 * - Mirrored to KV for fast reads
 * KV Writes: 1 (registry mirror)
 */
async function refreshRegistry(env: Env, trigger: string): Promise<void> {
  console.log(`[Registry] Refreshing CoinGecko registry (trigger: ${trigger})...`);
  
  try {
    // Fetch top 500 from CoinGecko (2 pages of 250)
    const page1 = await fetchCoinGeckoMarkets(1, 250);
    const page2 = await fetchCoinGeckoMarkets(2, 250);
    const allCoins = [...page1, ...page2];

    console.log(`[Registry] Fetched ${allCoins.length} coins from CoinGecko`);

    // Load existing registry from R2 (for append-only behavior)
    let existingRegistry: Registry | null = null;
    if (env.PRICE_R2) {
      try {
        const existing = await env.PRICE_R2.get(R2_REGISTRY_FILE);
        if (existing) {
          existingRegistry = await existing.json() as Registry;
          console.log(`[Registry] Loaded existing registry with ${existingRegistry.count} entries from R2`);
        }
      } catch (e) {
        console.warn('[Registry] No existing registry in R2, creating new one');
      }
    } else {
      // Fallback: Try to load from KV if R2 is not available
      try {
        const existingKv = await env.PRICE_KV.get(KV_REGISTRY_LATEST);
        if (existingKv) {
          existingRegistry = JSON.parse(existingKv) as Registry;
          console.log(`[Registry] Loaded existing registry with ${existingRegistry.count} entries from KV`);
        }
      } catch (e) {
        console.warn('[Registry] No existing registry in KV, creating new one');
      }
    }

    // Build new registry data from fresh CoinGecko data
    const newRegistry = buildRegistry(allCoins);
    
    // Merge with existing (append-only - never removes entries)
    const mergedRegistry = existingRegistry 
      ? mergeRegistry(existingRegistry, newRegistry)
      : newRegistry;

    // Write to R2 (master source of truth)
    if (env.PRICE_R2) {
      await env.PRICE_R2.put(R2_REGISTRY_FILE, JSON.stringify(mergedRegistry), {
        httpMetadata: {
          contentType: 'application/json'
        }
      });
      console.log('[Registry] Wrote master registry to R2');

      // Write daily composition snapshot
      const today = new Date().toISOString().split('T')[0];
      const snapshotKey = `${R2_SNAPSHOT_PREFIX}/${today}.json`;
      const snapshot = {
        date: today,
        timestamp: new Date().toISOString(),
        ids: allCoins.map((coin, idx) => ({
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          rank: idx + 1
        }))
      };
      await env.PRICE_R2.put(snapshotKey, JSON.stringify(snapshot), {
        httpMetadata: {
          contentType: 'application/json'
        }
      });
      console.log(`[Registry] Wrote daily composition snapshot: ${snapshotKey}`);
    }

    // KV Write 1: Mirror to KV for fast reads
    await env.PRICE_KV.put(KV_REGISTRY_LATEST, JSON.stringify(mergedRegistry));

    console.log(`[Registry] Successfully updated registry with ${mergedRegistry.count} entries`);
  } catch (error) {
    console.error('[Registry] Failed to refresh:', error);
    throw error;
  }
}

/**
 * Handle GET /prices/top500.json
 * Serves from KV (hot cache) - now includes embedded status
 */
async function handlePricesRequest(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const blobJson = await env.PRICE_KV.get(KV_PRICES_LATEST);
  
  if (!blobJson) {
    return jsonResponse({
      error: 'No price data available',
      message: 'Price data has not been fetched yet. It will be populated on the next cron run.'
    }, corsHeaders, 503);
  }

  const blob = JSON.parse(blobJson) as PricesWithStatus;

  return new Response(blobJson, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',  // 1 minute browser cache
      'X-Updated-At': blob.updatedAt,
      'X-Last-Fetch-Ok': blob.lastFetchOk ? 'true' : 'false'
    }
  });
}

/**
 * Handle GET /prices/status.json
 * Returns status extracted from the unified price blob
 * (Maintains backward compatibility for clients that used separate status endpoint)
 */
async function handleStatusRequest(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const blobJson = await env.PRICE_KV.get(KV_PRICES_LATEST);
  
  let status: Record<string, unknown>;
  if (blobJson) {
    const blob = JSON.parse(blobJson) as PricesWithStatus;
    // Extract status fields for backward compatibility
    status = {
      success: blob.lastFetchOk,
      count: blob.count,
      error: blob.lastFetchError,
      timestamp: blob.lastFetchTimestamp,
      trigger: blob.fetchTrigger,
      lastSuccess: blob.lastSuccessTimestamp,
      r2Enabled: blob.r2Enabled,
      service: 'ysl-price-cache',
      kvWritesPerDay: '~289 (down from 577, well under 1,000 free tier limit)',
      kvOptimization: 'Skip-if-unchanged enabled - writes only when data changes'
    };
  } else {
    status = {
      success: false,
      error: 'No status available - prices have not been fetched yet',
      timestamp: new Date().toISOString(),
      trigger: 'unknown',
      r2Enabled: !!env.PRICE_R2,
      service: 'ysl-price-cache'
    };
  }

  return jsonResponse(status, { ...corsHeaders, 'Cache-Control': 'no-cache' });
}

/**
 * Handle GET /registry/latest.json
 * Serves from KV mirror, falls back to R2 if KV miss
 * NOTE: Does NOT write to KV on fallback to avoid unaccounted writes
 */
async function handleRegistryRequest(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Try KV first (fast read)
  let registryJson = await env.PRICE_KV.get(KV_REGISTRY_LATEST);
  
  // Fall back to R2 if KV miss and R2 is available
  if (!registryJson && env.PRICE_R2) {
    try {
      const r2Object = await env.PRICE_R2.get(R2_REGISTRY_FILE);
      if (r2Object) {
        registryJson = await r2Object.text();
        // NOTE: We do NOT cache to KV here to avoid unaccounted writes
        // The daily cron will populate KV from R2
        console.log('[Registry] Served from R2 (KV miss, not caching to preserve write budget)');
      }
    } catch (e) {
      console.error('[Registry] Failed to read from R2:', e);
    }
  }

  if (!registryJson) {
    return jsonResponse({
      error: 'No registry data available',
      message: 'Registry has not been populated yet. Trigger /admin/refresh-registry or wait for daily cron.',
      r2Enabled: !!env.PRICE_R2
    }, corsHeaders, 503);
  }

  return new Response(registryJson, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'  // 1 hour browser cache
    }
  });
}

/**
 * Handle GET /snapshots/prices/top500/YYYY-MM-DD.json
 * Serves historical daily snapshots from R2
 */
async function handleSnapshotRequest(
  env: Env,
  date: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!env.PRICE_R2) {
    return jsonResponse({
      error: 'R2 not configured',
      message: 'Historical snapshots require R2 to be enabled'
    }, corsHeaders, 503);
  }

  const key = `${R2_PRICES_PREFIX}/${date}.json`;
  
  try {
    const r2Object = await env.PRICE_R2.get(key);
    if (!r2Object) {
      return jsonResponse({
        error: 'Snapshot not found',
        message: `No snapshot available for ${date}`
      }, corsHeaders, 404);
    }

    const body = await r2Object.text();
    return new Response(body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400'  // 24 hour cache (historical data doesn't change)
      }
    });
  } catch (e) {
    console.error(`[Snapshot] Failed to read ${key}:`, e);
    return jsonResponse({
      error: 'Failed to retrieve snapshot',
      message: e instanceof Error ? e.message : 'Unknown error'
    }, corsHeaders, 500);
  }
}
