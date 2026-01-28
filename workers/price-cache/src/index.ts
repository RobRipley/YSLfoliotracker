/**
 * YSL Price Cache Worker
 * 
 * Provides cached price data and token registry for the YSL Portfolio Tracker.
 * 
 * Features:
 * - Every 5 minutes: Fetch top 500 coins from CryptoRates.ai, store in KV
 * - Daily: Write snapshots to R2, refresh CoinGecko registry for logos
 * - HTTP endpoints for frontend to consume cached data
 */

import { Env, NormalizedPrices, Registry, PriceStatus, CryptoRatesCoin, CoinGeckoCoin } from './types';
import { fetchCryptoRatesPrices, normalizeCryptoRatesData } from './providers/cryptorates';
import { fetchCoinGeckoMarkets, buildRegistry, mergeRegistry } from './providers/coingecko';

// KV Keys
const KV_PRICES_LATEST = 'prices:top500:latest';
const KV_PRICES_UPDATED = 'prices:top500:updated_at';
const KV_PRICES_STATUS = 'prices:top500:status';
const KV_REGISTRY_LATEST = 'registry:coingecko:latest';
const KV_REGISTRY_UPDATED = 'registry:coingecko:updated_at';

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

    // CORS headers
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

      // Health check
      if (path === '/health' || path === '/') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'ysl-price-cache',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Request error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
        // Every 5 minutes: Refresh prices
        await refreshPrices(env);
      } else if (trigger === '0 9 * * *') {
        // Daily at 09:00 UTC: Write snapshots and refresh registry
        await writeDailySnapshot(env);
        await refreshRegistry(env);
      }
    } catch (error) {
      console.error(`[Cron] Error during ${trigger}:`, error);
      // Record error status
      await env.PRICE_KV.put(KV_PRICES_STATUS, JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        trigger
      }));
    }
  }
};

/**
 * Refresh prices from CryptoRates.ai
 */
async function refreshPrices(env: Env): Promise<void> {
  console.log('[Prices] Starting price refresh...');
  
  try {
    // Fetch from CryptoRates.ai
    const coins = await fetchCryptoRatesPrices(500);
    
    // Normalize the data
    const normalized = normalizeCryptoRatesData(coins);
    
    // Store in KV
    await env.PRICE_KV.put(KV_PRICES_LATEST, JSON.stringify(normalized));
    await env.PRICE_KV.put(KV_PRICES_UPDATED, new Date().toISOString());
    await env.PRICE_KV.put(KV_PRICES_STATUS, JSON.stringify({
      success: true,
      count: normalized.count,
      timestamp: normalized.updatedAt,
      trigger: 'scheduled'
    }));

    console.log(`[Prices] Successfully refreshed ${normalized.count} coins`);
  } catch (error) {
    console.error('[Prices] Failed to refresh:', error);
    
    // Update status to indicate failure
    await env.PRICE_KV.put(KV_PRICES_STATUS, JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      trigger: 'scheduled'
    }));
    
    throw error;
  }
}

/**
 * Write daily price snapshot to R2
 */
async function writeDailySnapshot(env: Env): Promise<void> {
  console.log('[Snapshot] Writing daily price snapshot...');
  
  // Get current prices from KV
  const pricesJson = await env.PRICE_KV.get(KV_PRICES_LATEST);
  if (!pricesJson) {
    console.warn('[Snapshot] No prices in KV to snapshot');
    return;
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `${R2_PRICES_PREFIX}/${today}.json`;
  
  // Write to R2
  await env.PRICE_R2.put(key, pricesJson, {
    httpMetadata: {
      contentType: 'application/json'
    }
  });

  console.log(`[Snapshot] Wrote daily snapshot: ${key}`);
}

/**
 * Refresh CoinGecko registry for logos and stable IDs
 */
async function refreshRegistry(env: Env): Promise<void> {
  console.log('[Registry] Refreshing CoinGecko registry...');
  
  try {
    // Fetch top 500 from CoinGecko (2 pages of 250)
    const page1 = await fetchCoinGeckoMarkets(1, 250);
    const page2 = await fetchCoinGeckoMarkets(2, 250);
    const allCoins = [...page1, ...page2];

    console.log(`[Registry] Fetched ${allCoins.length} coins from CoinGecko`);

    // Load existing registry from R2 (for append-only behavior)
    let existingRegistry: Registry | null = null;
    try {
      const existing = await env.PRICE_R2.get(R2_REGISTRY_FILE);
      if (existing) {
        existingRegistry = await existing.json() as Registry;
      }
    } catch (e) {
      console.warn('[Registry] No existing registry found, creating new one');
    }

    // Build new registry data
    const newRegistry = buildRegistry(allCoins);
    
    // Merge with existing (append-only)
    const mergedRegistry = existingRegistry 
      ? mergeRegistry(existingRegistry, newRegistry)
      : newRegistry;

    // Write merged registry to R2
    await env.PRICE_R2.put(R2_REGISTRY_FILE, JSON.stringify(mergedRegistry), {
      httpMetadata: {
        contentType: 'application/json'
      }
    });

    // Also write to KV for fast reads
    await env.PRICE_KV.put(KV_REGISTRY_LATEST, JSON.stringify(mergedRegistry));
    await env.PRICE_KV.put(KV_REGISTRY_UPDATED, new Date().toISOString());

    // Write daily snapshot of top 500 composition
    const today = new Date().toISOString().split('T')[0];
    const snapshotKey = `${R2_SNAPSHOT_PREFIX}/${today}.json`;
    const snapshot = {
      date: today,
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

    console.log(`[Registry] Successfully updated registry with ${mergedRegistry.count} entries`);
  } catch (error) {
    console.error('[Registry] Failed to refresh:', error);
    throw error;
  }
}

/**
 * Handle GET /prices/top500.json
 */
async function handlePricesRequest(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const pricesJson = await env.PRICE_KV.get(KV_PRICES_LATEST);
  const updatedAt = await env.PRICE_KV.get(KV_PRICES_UPDATED);
  
  if (!pricesJson) {
    return new Response(JSON.stringify({
      error: 'No price data available',
      message: 'Price data has not been fetched yet'
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(pricesJson, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'X-Updated-At': updatedAt || 'unknown'
    }
  });
}

/**
 * Handle GET /prices/status.json
 */
async function handleStatusRequest(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const statusJson = await env.PRICE_KV.get(KV_PRICES_STATUS);
  const updatedAt = await env.PRICE_KV.get(KV_PRICES_UPDATED);
  
  let status: PriceStatus;
  if (statusJson) {
    status = JSON.parse(statusJson);
  } else {
    status = {
      success: false,
      error: 'No status available',
      timestamp: new Date().toISOString(),
      trigger: 'unknown'
    };
  }

  return new Response(JSON.stringify({
    ...status,
    updatedAt,
    service: 'ysl-price-cache'
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}

/**
 * Handle GET /registry/latest.json
 */
async function handleRegistryRequest(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Try KV first for fast reads
  let registryJson = await env.PRICE_KV.get(KV_REGISTRY_LATEST);
  
  // Fall back to R2 if not in KV
  if (!registryJson) {
    try {
      const r2Object = await env.PRICE_R2.get(R2_REGISTRY_FILE);
      if (r2Object) {
        registryJson = await r2Object.text();
        // Cache in KV for next time
        await env.PRICE_KV.put(KV_REGISTRY_LATEST, registryJson);
      }
    } catch (e) {
      console.error('[Registry] Failed to read from R2:', e);
    }
  }

  if (!registryJson) {
    return new Response(JSON.stringify({
      error: 'No registry data available',
      message: 'Registry has not been populated yet'
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(registryJson, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
