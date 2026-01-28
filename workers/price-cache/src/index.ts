/**
 * YSL Price Cache Worker
 * 
 * Provides cached price data and token registry for the YSL Portfolio Tracker.
 * 
 * Architecture:
 * - KV: Hot cache for real-time access (prices, status, registry mirror)
 * - R2: Cold storage for historical snapshots (daily prices, master registry)
 * 
 * KV Write Budget (Free Tier: 1,000 writes/day):
 * - 5-minute refresh: 2 writes (latest + status) × 288 runs = 576 writes/day
 * - Daily cron: 1 write (registry KV mirror)
 * - Total estimate: ~577 writes/day
 * 
 * Cron Schedules:
 * - Every 5 min: Refresh prices from CryptoRates.ai → KV
 * - Daily 09:00 UTC: Write snapshot to R2, refresh CoinGecko registry
 * 
 * R2 Requirement:
 * - R2 is REQUIRED for daily snapshot functionality
 * - If R2 is not configured, daily cron will hard fail with clear error in status
 */

import { Env, NormalizedPrices, Registry, PriceStatus, DailySnapshot } from './types';
import { fetchCryptoRatesPrices, normalizeCryptoRatesData } from './providers/cryptorates';
import { fetchCoinGeckoMarkets, buildRegistry, mergeRegistry } from './providers/coingecko';

// KV Keys (minimal set to stay under free tier)
const KV_PRICES_LATEST = 'prices:top500:latest';
const KV_PRICES_STATUS = 'prices:top500:status';  // Includes updatedAt and lastSuccess
const KV_REGISTRY_LATEST = 'registry:coingecko:latest';

// R2 Paths
const R2_PRICES_PREFIX = 'prices/top500';
const R2_REGISTRY_FILE = 'registry/coingecko_registry.json';
const R2_SNAPSHOT_PREFIX = 'registry/top500_snapshot';

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
          kvEnabled: !!env.PRICE_KV
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
        // Every 5 minutes: Refresh prices to KV
        await refreshPrices(env, 'scheduled');
      } else if (trigger === '0 9 * * *') {
        // Daily at 09:00 UTC: Write snapshot to R2 and refresh registry
        // R2 is REQUIRED for this cron - hard fail if not configured
        if (!env.PRICE_R2) {
          const errorStatus: PriceStatus = {
            success: false,
            error: 'R2 disabled - daily snapshot skipped. Enable R2 in Cloudflare Dashboard and update wrangler.toml',
            timestamp: new Date().toISOString(),
            trigger: 'daily-snapshot',
            r2Enabled: false
          };
          await env.PRICE_KV.put(KV_PRICES_STATUS, JSON.stringify(errorStatus));
          console.error('[Daily] R2 is not configured! Daily snapshots require R2 bucket.');
          throw new Error('R2 is not configured. Daily snapshot requires R2 bucket "ysl-price-snapshots".');
        }
        
        await writeDailySnapshot(env, 'scheduled');
        await refreshRegistry(env, 'scheduled');
      }
    } catch (error) {
      console.error(`[Cron] Error during ${trigger}:`, error);
      // Status already written in individual functions or above
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
 * KV Writes: 2 per call (latest + status)
 * At 288 calls/day (every 5 min), this is 576 writes/day
 */
async function refreshPrices(env: Env, trigger: string): Promise<void> {
  console.log(`[Prices] Starting price refresh (trigger: ${trigger})...`);
  
  // Load previous status to preserve lastSuccess
  let lastSuccess: string | undefined;
  try {
    const prevStatusJson = await env.PRICE_KV.get(KV_PRICES_STATUS);
    if (prevStatusJson) {
      const prevStatus = JSON.parse(prevStatusJson) as PriceStatus;
      lastSuccess = prevStatus.lastSuccess;
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  try {
    // Fetch from CryptoRates.ai
    const coins = await fetchCryptoRatesPrices(500);
    
    // Normalize the data
    const normalized = normalizeCryptoRatesData(coins);
    
    // KV Write 1: Store price data
    await env.PRICE_KV.put(KV_PRICES_LATEST, JSON.stringify(normalized));
    
    // KV Write 2: Store status (includes updatedAt and lastSuccess)
    const status: PriceStatus = {
      success: true,
      count: normalized.count,
      timestamp: normalized.updatedAt,
      trigger,
      lastSuccess: normalized.updatedAt,  // Update lastSuccess on success
      r2Enabled: !!env.PRICE_R2
    };
    await env.PRICE_KV.put(KV_PRICES_STATUS, JSON.stringify(status));

    console.log(`[Prices] Successfully refreshed ${normalized.count} coins`);
  } catch (error) {
    console.error('[Prices] Failed to refresh:', error);
    
    // Update status to indicate failure (preserve lastSuccess)
    const status: PriceStatus = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      trigger,
      lastSuccess,  // Preserve previous lastSuccess
      r2Enabled: !!env.PRICE_R2
    };
    await env.PRICE_KV.put(KV_PRICES_STATUS, JSON.stringify(status));
    
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
  const pricesJson = await env.PRICE_KV.get(KV_PRICES_LATEST);
  if (!pricesJson) {
    console.warn('[Snapshot] No prices in KV to snapshot');
    return;
  }

  const prices = JSON.parse(pricesJson) as NormalizedPrices;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `${R2_PRICES_PREFIX}/${today}.json`;
  
  // Add snapshot metadata
  const snapshot: DailySnapshot = {
    snapshotDate: today,
    snapshotTimestamp: new Date().toISOString(),
    source: prices.source,
    updatedAt: prices.updatedAt,
    count: prices.count,
    bySymbol: prices.bySymbol
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
 * Serves from KV (hot cache)
 */
async function handlePricesRequest(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const pricesJson = await env.PRICE_KV.get(KV_PRICES_LATEST);
  
  if (!pricesJson) {
    return jsonResponse({
      error: 'No price data available',
      message: 'Price data has not been fetched yet. It will be populated on the next cron run.'
    }, corsHeaders, 503);
  }

  // Get status for X-Updated-At header
  const statusJson = await env.PRICE_KV.get(KV_PRICES_STATUS);
  let updatedAt = 'unknown';
  if (statusJson) {
    const status = JSON.parse(statusJson) as PriceStatus;
    updatedAt = status.timestamp;
  }

  return new Response(pricesJson, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',  // 1 minute browser cache
      'X-Updated-At': updatedAt
    }
  });
}

/**
 * Handle GET /prices/status.json
 * Returns cache status including updatedAt and lastSuccess
 */
async function handleStatusRequest(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const statusJson = await env.PRICE_KV.get(KV_PRICES_STATUS);
  
  let status: PriceStatus;
  if (statusJson) {
    status = JSON.parse(statusJson);
  } else {
    status = {
      success: false,
      error: 'No status available - prices have not been fetched yet',
      timestamp: new Date().toISOString(),
      trigger: 'unknown',
      r2Enabled: !!env.PRICE_R2
    };
  }

  // Add service info
  const response = {
    ...status,
    service: 'ysl-price-cache',
    kvWritesPerDay: '~577 (well under 1,000 free tier limit)',
    r2Enabled: !!env.PRICE_R2
  };

  return jsonResponse(response, { ...corsHeaders, 'Cache-Control': 'no-cache' });
}

/**
 * Handle GET /registry/latest.json
 * Serves from KV mirror, falls back to R2 if KV miss
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
        // Cache in KV for future fast reads (don't count this as a "scheduled" write)
        await env.PRICE_KV.put(KV_REGISTRY_LATEST, registryJson);
        console.log('[Registry] Served from R2 and cached to KV');
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
