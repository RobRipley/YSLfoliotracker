/**
 * Canister Sync Service
 * 
 * Handles syncing portfolio data between localStorage (fast, local) 
 * and the ICP backend canister (persistent, cross-device).
 * 
 * Strategy:
 * - Writes: save to localStorage immediately, then async-save to canister
 *   ONLY when user-intent data has actually changed (hash comparison)
 * - Reads on init: load from canister once (authoritative), fall back to localStorage
 * - Hydration gate: prevents save-after-load feedback loops
 * - Debounced saves: batch rapid changes into a single canister write
 */

import type { BackendActor } from '../hooks/useActor';
import type { Store } from './dataModel';

const DEBOUNCE_MS = 2000; // Wait 2s after last change before saving to canister
const MAX_DEBOUNCE_MS = 10000; // Force save after 10s even if changes keep coming

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let firstChangeTime: number | null = null;
let currentActor: BackendActor | null = null;
let currentPrincipal: string | null = null;
let isSaving = false;

// ============================================================================
// USER PROFILE (synced inside the portfolio blob)
// ============================================================================
interface SyncProfile {
  firstName: string;
  lastName: string;
}
let currentProfile: SyncProfile | null = null;

/**
 * Set the user profile to include in canister blob saves.
 * Called from Layout.tsx when profile is saved or loaded.
 */
export function setSyncProfile(profile: SyncProfile | null): void {
  currentProfile = profile;
}

/**
 * Get the currently loaded profile (synchronous read).
 * Layout.tsx polls this after canister sync instead of relying solely on events.
 */
export function getSyncProfile(): SyncProfile | null {
  return currentProfile;
}

/**
 * Update the profile AND trigger a canister save.
 * Called when user saves their name in the modal.
 * Always forces a save because the profile may exist in localStorage
 * but not yet in the canister blob (e.g., cross-device first use).
 */
export function updateProfileAndSave(profile: SyncProfile, store: Store): void {
  currentProfile = profile;
  // Always force a save — the profile might be in localStorage but not in the canister blob
  lastSavedHash = '';
  console.log('[CanisterSync] Profile updated, forcing blob save:', profile.firstName, profile.lastName);
  queueCanisterSave(store);
}

// ============================================================================
// HYDRATION GATE
// Prevents the save→load→save feedback loop
// ============================================================================
let isHydrating = false;

/**
 * Set hydration state. While hydrating, canister saves are suppressed.
 */
export function setHydrating(hydrating: boolean): void {
  isHydrating = hydrating;
}

// ============================================================================
// HASH-BASED SAVE DEDUPLICATION
// Only save to canister when user-intent data has actually changed
// ============================================================================
let lastSavedHash: string = '';

/**
 * Strip a holding down to user-intent fields only.
 * Removes transient/derived market data that changes on every price tick
 * (prices, market cap, 24h change, logos, timestamps).
 *
 * Note: coingeckoId is KEPT because it's stable user intent (which specific
 * coin the user meant). logoUrl is stripped because it comes from the shared
 * on-chain logo registry, not per-user data.
 */
function stripHoldingToUserIntent(h: any): Record<string, unknown> {
  const { lastPriceUsd, lastMarketCapUsd, lastChange24hPct, lastMarketDataAt, logoUrl, ...userFields } = h;
  return userFields;
}

/**
 * Create a canonical user-intent-only representation of the store.
 * Used for both hashing (change detection) and the actual canister blob.
 * 
 * What's included (user decisions):
 *   holdings (id, symbol, tokensOwned, avgCost, purchaseDate, notes, categoryLocked, lockedCategory, coingeckoId)
 *   settings, transactions, cash, cashNotes
 *   userProfile (firstName, lastName)
 *
 * What's excluded (derived/transient):
 *   lastPriceUsd, lastMarketCapUsd, lastChange24hPct, lastMarketDataAt (price ticks)
 *   logoUrl (comes from shared on-chain logo registry, not per-user data)
 *   lastSeenCategories (runtime categorization state)
 *   portfolioSnapshots (derived from price history)
 */
function getUserIntentStore(store: Store): Record<string, unknown> {
  return {
    holdings: store.holdings
      .map(stripHoldingToUserIntent)
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    settings: store.settings,
    transactions: store.transactions,
    cash: store.cash,
    cashNotes: store.cashNotes || '',
    userProfile: currentProfile || { firstName: '', lastName: '' },
  };
}

/**
 * Fast djb2 hash for comparing store states.
 * Only hashes user-intent data — excludes transient/derived fields.
 */
function hashUserIntent(store: Store): string {
  const str = JSON.stringify(getUserIntentStore(store));
  
  // djb2 hash
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return hash.toString(36);
}

/**
 * Update the baseline hash to the current store state.
 * Call this after hydration to prevent the first post-hydration tick
 * from triggering a save.
 */
export function updateHashBaseline(store: Store): void {
  lastSavedHash = hashUserIntent(store);
  console.log('[CanisterSync] Hash baseline set:', lastSavedHash);
}


// ============================================================================
// SYNC STATUS LISTENERS (for UI feedback)
// ============================================================================
type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'loading';
type SyncListener = (status: SyncStatus, detail?: string) => void;
const listeners: Set<SyncListener> = new Set();

export function onSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(status: SyncStatus, detail?: string) {
  listeners.forEach(fn => fn(status, detail));
}

// ============================================================================
// ACTOR MANAGEMENT
// ============================================================================

/**
 * Set the actor instance for canister calls.
 */
export function setActor(actor: BackendActor | null): void {
  currentActor = actor;
}

/**
 * Set the principal for canister saves.
 */
export function setSyncPrincipal(principal: string | null): void {
  currentPrincipal = principal;
}


// ============================================================================
// SAVE (localStorage → canister)
// ============================================================================

/**
 * Queue a save to the canister. Debounced and hash-checked.
 * 
 * Saves are skipped when:
 * - No actor or principal (not logged in)
 * - Currently hydrating from canister (prevents save→load→save loop)
 * - User-intent data hasn't changed since last save (hash comparison)
 */
export function queueCanisterSave(store: Store): void {
  // Gate 1: Not connected
  if (!currentActor || !currentPrincipal) return;
  
  // Gate 2: Hydration in progress
  if (isHydrating) {
    console.log('[CanisterSync] Skipped save (hydrating)');
    return;
  }
  
  // Gate 3: Hash comparison — skip if user-intent data unchanged
  const currentHash = hashUserIntent(store);
  if (currentHash === lastSavedHash) {
    // Data hasn't meaningfully changed (just price ticks, snapshots, etc.)
    return;
  }

  console.log('[CanisterSync] User data changed, queuing save. Hash:', lastSavedHash, '→', currentHash);
  
  if (!firstChangeTime) {
    firstChangeTime = Date.now();
  }

  // Clear existing debounce timer
  if (saveTimeout) clearTimeout(saveTimeout);

  // Force save if accumulating changes too long
  const elapsed = Date.now() - firstChangeTime;
  if (elapsed >= MAX_DEBOUNCE_MS) {
    flushSave(store, currentHash);
    return;
  }

  // Capture for the debounced closure
  const storeSnapshot = store;
  const hash = currentHash;
  saveTimeout = setTimeout(() => flushSave(storeSnapshot, hash), DEBOUNCE_MS);
}

async function flushSave(store: Store, hash: string): Promise<void> {
  if (!currentActor || !currentPrincipal || isSaving) return;

  // Final hash check (data may have reverted during debounce)
  const finalHash = hashUserIntent(store);
  if (finalHash === lastSavedHash) {
    console.log('[CanisterSync] Skipped save (hash reverted during debounce)');
    firstChangeTime = null;
    return;
  }

  isSaving = true;
  emit('saving');

  // Only persist user-intent data — no prices, market caps, or other derived fields
  const userIntentStore = getUserIntentStore(store);
  const blob = JSON.stringify({
    version: 1,
    timestamp: Date.now(),
    principal: currentPrincipal,
    store: userIntentStore,
  });

  try {
    const result = await currentActor.save_portfolio_blob(blob);
    if (result.ok) {
      lastSavedHash = finalHash;
      console.log('[CanisterSync] Saved to canister. New hash:', lastSavedHash);
      emit('saved');
      setTimeout(() => emit('idle'), 2000);
    } else {
      console.error('[CanisterSync] Save returned ok=false');
      emit('error', 'Save returned failure');
    }
  } catch (err) {
    console.error('[CanisterSync] Failed to save to canister:', err);
    emit('error', err instanceof Error ? err.message : 'Unknown error');
  } finally {
    isSaving = false;
    firstChangeTime = null;
  }
}


// ============================================================================
// LOAD (canister → localStorage)
// ============================================================================

/**
 * Force an immediate save to canister (e.g., before page unload).
 */
export async function forceSave(store: Store): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (!currentActor || !currentPrincipal) return;
  const hash = hashUserIntent(store);
  if (hash !== lastSavedHash) {
    await flushSave(store, hash);
  }
}

/**
 * Load portfolio data from the canister.
 * Returns the parsed Store and userProfile, or null if no data exists.
 */
export async function loadFromCanister(actor: BackendActor): Promise<{ store: Store; userProfile?: SyncProfile } | null> {
  emit('loading');
  try {
    const result = await actor.load_portfolio_blob();
    // Candid optional: [] = None, [value] = Some(value)
    if (result && result.length > 0) {
      const parsed = JSON.parse(result[0]);
      console.log('[CanisterSync] Loaded from canister, holdings:', parsed.store?.holdings?.length || 0);
      
      // Extract profile from blob if present
      const userProfile = parsed.store?.userProfile as SyncProfile | undefined;
      if (userProfile && (userProfile.firstName || userProfile.lastName)) {
        currentProfile = userProfile;
        console.log('[CanisterSync] Loaded profile from blob:', userProfile.firstName, userProfile.lastName);
      }
      
      emit('idle');
      return { store: parsed.store || null, userProfile };
    }
    console.log('[CanisterSync] No data in canister for this user');
    emit('idle');
    return null;
  } catch (err) {
    console.error('[CanisterSync] Failed to load from canister:', err);
    emit('error', 'Failed to load from canister');
    return null;
  }
}


// ============================================================================
// SHARED LOGO REGISTRY (on-chain, shared across all users)
// ============================================================================

// --- Legacy URL-based functions (kept for backward compat) ---

/**
 * Load the entire shared logo URL registry from the canister.
 * Returns a Map of coingeckoId → logoUrl.
 * This is a query call (free, fast).
 */
export async function loadLogoRegistry(actor: BackendActor): Promise<Map<string, string>> {
  try {
    const entries = await actor.get_logo_registry();
    const map = new Map<string, string>();
    for (const [id, url] of entries) {
      map.set(id, url);
    }
    console.log(`[CanisterSync] Loaded logo URL registry: ${map.size} entries`);
    return map;
  } catch (err) {
    console.error('[CanisterSync] Failed to load logo registry:', err);
    return new Map();
  }
}

/**
 * Write a single logo URL to the shared registry.
 */
export async function writeLogoToRegistry(actor: BackendActor, coingeckoId: string, logoUrl: string): Promise<void> {
  try {
    await actor.set_logo(coingeckoId, logoUrl);
    console.log(`[CanisterSync] Wrote logo URL to registry: ${coingeckoId}`);
  } catch (err) {
    console.error(`[CanisterSync] Failed to write logo URL ${coingeckoId}:`, err);
  }
}

/**
 * Bulk write logo URLs to the shared registry.
 */
export async function writeLogosToRegistry(actor: BackendActor, entries: Array<[string, string]>): Promise<number> {
  if (entries.length === 0) return 0;
  try {
    const count = await actor.set_logos_bulk(entries);
    console.log(`[CanisterSync] Bulk wrote ${Number(count)} new logo URLs to registry (${entries.length} submitted)`);
    return Number(count);
  } catch (err) {
    console.error('[CanisterSync] Failed to bulk write logo URLs:', err);
    return 0;
  }
}

// --- Image blob functions (actual image bytes stored on-chain) ---

/**
 * Get the backend canister ID for constructing logo URLs.
 * Logos are served via http_request at: https://{canisterId}.icp0.io/logo/{coingeckoId}
 */
export function getLogoCanisterBaseUrl(): string {
  const isIC = typeof window !== 'undefined' &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.startsWith('127.');

  if (isIC) {
    // Must use .raw.icp0.io for uncertified http_request responses
    return 'https://ranje-7qaaa-aaaas-qdwxq-cai.raw.icp0.io';
  }
  // Local development
  return 'http://127.0.0.1:4943/?canisterId=uxrrr-q7777-77774-qaaaq-cai';
}

/**
 * Get the direct URL for a logo image stored in the canister.
 * This URL is served via the http_request handler.
 * Uses .raw.icp0.io since we don't have certified variables.
 */
export function getLogoImageUrl(coingeckoId: string): string {
  const isIC = typeof window !== 'undefined' &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.startsWith('127.');

  if (isIC) {
    return `https://ranje-7qaaa-aaaas-qdwxq-cai.raw.icp0.io/logo/${coingeckoId}`;
  }
  return `http://uxrrr-q7777-77774-qaaaq-cai.localhost:4943/logo/${coingeckoId}`;
}

/**
 * Load the list of all coingeckoIds that have stored logo images.
 * Query call (free, fast). Use this to know which logos are already cached.
 */
export async function loadLogoImageIds(actor: BackendActor): Promise<Set<string>> {
  try {
    const ids = await actor.get_logo_image_ids();
    const set = new Set(ids);
    console.log(`[CanisterSync] Logo image registry: ${set.size} images stored`);
    return set;
  } catch (err) {
    console.error('[CanisterSync] Failed to load logo image IDs:', err);
    return new Set();
  }
}

/**
 * Cloudflare Worker proxy for downloading CoinGecko images.
 * The IC frontend domain can't fetch directly from coin-images.coingecko.com
 * due to CORS, so we route through the price cache worker which adds CORS headers.
 * NOTE: Worker URL still uses legacy ysl-price-cache name on Cloudflare.
 */
const IMAGE_PROXY_BASE = 'https://ysl-price-cache.robertripleyjunior.workers.dev/proxy/image';

/**
 * Fetch an image from a URL and return it as a Uint8Array + content type.
 * Routes through the Cloudflare Worker proxy to avoid CORS issues.
 * Used to download logo images before uploading to the canister.
 */
export async function fetchImageAsBytes(imageUrl: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    // Route through worker proxy to bypass CORS
    const proxyUrl = `${IMAGE_PROXY_BASE}?url=${encodeURIComponent(imageUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Enforce 100KB limit (same as canister)
    if (data.length > 102_400) {
      console.warn(`[CanisterSync] Image too large (${(data.length / 1024).toFixed(1)}KB), skipping`);
      return null;
    }

    // Normalize content type
    let normalizedType = 'image/png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) normalizedType = 'image/jpeg';
    else if (contentType.includes('svg')) normalizedType = 'image/svg+xml';
    else if (contentType.includes('webp')) normalizedType = 'image/webp';
    else if (contentType.includes('png')) normalizedType = 'image/png';

    return { data, contentType: normalizedType };
  } catch (err) {
    console.warn(`[CanisterSync] Failed to fetch image from ${imageUrl}:`, err);
    return null;
  }
}

/**
 * Upload a single logo image (actual bytes) to the canister.
 * Fetches the image from the URL, then stores the bytes on-chain.
 */
export async function uploadLogoImage(
  actor: BackendActor,
  coingeckoId: string,
  imageUrl: string
): Promise<boolean> {
  try {
    const result = await fetchImageAsBytes(imageUrl);
    if (!result) return false;

    await actor.set_logo_image(coingeckoId, result.contentType, result.data);
    console.log(`[CanisterSync] Uploaded logo image: ${coingeckoId} (${(result.data.length / 1024).toFixed(1)}KB)`);
    return true;
  } catch (err) {
    console.error(`[CanisterSync] Failed to upload logo image ${coingeckoId}:`, err);
    return false;
  }
}

/**
 * Bulk upload logo images to the canister.
 * Takes an array of [coingeckoId, imageUrl] pairs.
 * Fetches each image, then uploads all as a batch.
 * Returns the number of new images stored.
 */
export async function uploadLogoImagesBulk(
  actor: BackendActor,
  entries: Array<[string, string]>,
  batchSize = 10
): Promise<number> {
  if (entries.length === 0) return 0;

  let totalAdded = 0;

  // Process in batches to avoid overwhelming the network
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    // Fetch all images in parallel
    const fetchResults = await Promise.allSettled(
      batch.map(async ([id, url]) => {
        const result = await fetchImageAsBytes(url);
        if (!result) return null;
        return [id, result.contentType, result.data] as [string, string, Uint8Array];
      })
    );

    // Filter to successful fetches
    const validEntries: Array<[string, string, Uint8Array]> = [];
    for (const result of fetchResults) {
      if (result.status === 'fulfilled' && result.value) {
        validEntries.push(result.value);
      }
    }

    if (validEntries.length > 0) {
      try {
        const count = await actor.set_logo_images_bulk(validEntries);
        const added = Number(count);
        totalAdded += added;
        console.log(`[CanisterSync] Batch ${Math.floor(i / batchSize) + 1}: uploaded ${added} new logo images`);
      } catch (err) {
        console.error(`[CanisterSync] Batch upload failed:`, err);
      }
    }
  }

  console.log(`[CanisterSync] Total: uploaded ${totalAdded} new logo images (${entries.length} attempted)`);
  return totalAdded;
}
