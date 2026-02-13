/**
 * Canister Sync Service
 * 
 * Handles syncing portfolio data between localStorage (fast, local) 
 * and the ICP backend canister (persistent, cross-device).
 * 
 * Strategy:
 * - Writes: save to localStorage immediately, then async-save to canister
 * - Reads on init: load from canister (authoritative), fall back to localStorage
 * - Debounced saves: batch rapid changes into a single canister write
 */

import type { BackendActor } from '../hooks/useActor';
import type { Store } from './dataModel';

const DEBOUNCE_MS = 2000; // Wait 2s after last change before saving to canister
const MAX_DEBOUNCE_MS = 10000; // Force save after 10s even if changes keep coming

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let firstChangeTime: number | null = null;
let pendingBlob: string | null = null;
let currentActor: BackendActor | null = null;
let isSaving = false;

// Listeners for sync status UI feedback
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

/**
 * Set the actor instance to use for canister calls.
 * Called when the actor is created/updated from useActor hook.
 */
export function setActor(actor: BackendActor | null): void {
  currentActor = actor;
}

/**
 * Queue a save to the canister. Debounced to avoid hammering the canister
 * on every keystroke or price update.
 */
export function queueCanisterSave(store: Store, principal: string): void {
  if (!currentActor) {
    // No actor yet (not logged in, or actor still initializing)
    // Data is still safe in localStorage
    return;
  }

  // Serialize the store
  const blob = JSON.stringify({
    version: 1,
    timestamp: Date.now(),
    principal,
    store,
  });

  pendingBlob = blob;

  if (!firstChangeTime) {
    firstChangeTime = Date.now();
  }

  // Clear existing debounce timer
  if (saveTimeout) clearTimeout(saveTimeout);

  // Force save if we've been accumulating changes too long
  const elapsed = Date.now() - firstChangeTime;
  if (elapsed >= MAX_DEBOUNCE_MS) {
    flushSave();
    return;
  }

  // Otherwise debounce
  saveTimeout = setTimeout(flushSave, DEBOUNCE_MS);
}

async function flushSave(): Promise<void> {
  if (!pendingBlob || !currentActor || isSaving) return;

  const blob = pendingBlob;
  pendingBlob = null;
  firstChangeTime = null;
  isSaving = true;
  emit('saving');

  try {
    const result = await currentActor.save_portfolio_blob(blob);
    if (result.ok) {
      console.log('[CanisterSync] Saved to canister, timestamp:', result.timestamp.toString());
      emit('saved');
      // Reset to idle after a brief display
      setTimeout(() => emit('idle'), 2000);
    } else {
      console.error('[CanisterSync] Save returned ok=false');
      emit('error', 'Save returned failure');
    }
  } catch (err) {
    console.error('[CanisterSync] Failed to save to canister:', err);
    emit('error', err instanceof Error ? err.message : 'Unknown error');
    // Data is still safe in localStorage - will retry on next change
  } finally {
    isSaving = false;
  }

  // If more changes came in while we were saving, flush again
  if (pendingBlob) {
    setTimeout(flushSave, DEBOUNCE_MS);
  }
}

/**
 * Force an immediate save to canister (e.g., before page unload).
 */
export async function forceSave(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  await flushSave();
}

/**
 * Load portfolio data from the canister.
 * Returns the parsed Store or null if no data exists.
 */
export async function loadFromCanister(actor: BackendActor): Promise<Store | null> {
  emit('loading');
  try {
    const result = await actor.load_portfolio_blob();
    // Candid optional: [] = None, [value] = Some(value)
    if (result && result.length > 0) {
      const parsed = JSON.parse(result[0]);
      console.log('[CanisterSync] Loaded from canister, holdings:', parsed.store?.holdings?.length || 0);
      emit('idle');
      return parsed.store || null;
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
