/**
 * Data Persistence Module
 * 
 * Handles localStorage persistence with schema versioning and migration.
 * Supports principal-aware storage for multi-user scenarios.
 */

import { type Store } from './dataModel';

const STORAGE_KEY_PREFIX = 'crypto-portfolio-store';
const SCHEMA_VERSION = 1;

// Current principal for storage isolation
let currentPrincipal: string | null = null;

interface PersistedData {
  version: number;
  timestamp: number;
  principal?: string; // Track which principal this data belongs to
  store: Store;
}

/**
 * Set the current principal for storage isolation
 */
export function setPrincipal(principal: string | null): void {
  currentPrincipal = principal;
  console.log('[Persistence] Principal set to:', principal?.slice(0, 8) || 'null');
}

/**
 * Get the current principal
 */
export function getCurrentPrincipal(): string | null {
  return currentPrincipal;
}

/**
 * Get the storage key for the current principal
 */
function getStorageKey(): string {
  if (currentPrincipal && currentPrincipal !== '2vxsx-fae') {
    return `${STORAGE_KEY_PREFIX}-${currentPrincipal}`;
  }
  // Fallback to generic key for anonymous/dev mode
  return STORAGE_KEY_PREFIX;
}

/**
 * Save the entire store to localStorage
 */
export function saveStore(store: Store): void {
  try {
    const data: PersistedData = {
      version: SCHEMA_VERSION,
      timestamp: Date.now(),
      principal: currentPrincipal || undefined,
      store,
    };
    
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(data));
    console.log('[Persistence] Store saved to:', key);
  } catch (error) {
    console.error('Failed to save store to localStorage:', error);
    throw new Error('Failed to persist data');
  }
}

/**
 * Load store from localStorage with schema migration
 */
export function loadStore(): Store | null {
  try {
    const key = getStorageKey();
    const stored = localStorage.getItem(key);
    if (!stored) {
      console.log('[Persistence] No data found for key:', key);
      return null;
    }

    const data: PersistedData = JSON.parse(stored);
    
    // Validate schema
    if (!validateSchema(data)) {
      console.warn('Invalid schema detected, clearing corrupted data');
      localStorage.removeItem(key);
      return null;
    }

    // Migrate if needed
    if (data.version !== SCHEMA_VERSION) {
      const migrated = migrateSchema(data.store, data.version, SCHEMA_VERSION);
      return migrated;
    }

    console.log('[Persistence] Store loaded from:', key, 'with', data.store.holdings?.length || 0, 'holdings');
    return data.store;
  } catch (error) {
    console.error('Failed to load store from localStorage:', error);
    return null;
  }
}

/**
 * Validate the loaded data structure
 */
function validateSchema(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.version !== 'number') return false;
  if (!data.store || typeof data.store !== 'object') return false;
  
  const store = data.store;
  if (!Array.isArray(store.holdings)) return false;
  if (!Array.isArray(store.transactions)) return false;
  if (!Array.isArray(store.portfolioSnapshots)) return false;
  if (!store.settings || typeof store.settings !== 'object') return false;
  if (typeof store.cash !== 'number') return false;
  
  return true;
}

/**
 * Migrate data between schema versions
 */
function migrateSchema(oldStore: Store, oldVersion: number, newVersion: number): Store {
  let store = { ...oldStore };

  // Future migrations would go here
  // Example:
  // if (oldVersion === 1 && newVersion === 2) {
  //   store = migrateV1ToV2(store);
  // }

  console.log(`Migrated store from version ${oldVersion} to ${newVersion}`);
  return store;
}

/**
 * Clear all persisted data for the current principal
 */
export function clearPersistedData(): void {
  try {
    const key = getStorageKey();
    localStorage.removeItem(key);
    console.log('[Persistence] Cleared data for key:', key);
  } catch (error) {
    console.error('Failed to clear persisted data:', error);
  }
}

/**
 * Check if persisted data exists for current principal
 */
export function hasPersistedData(): boolean {
  try {
    return localStorage.getItem(getStorageKey()) !== null;
  } catch {
    return false;
  }
}

/**
 * Clear the mock data flag for the current principal
 */
export function clearMockDataFlag(): void {
  if (currentPrincipal && currentPrincipal !== '2vxsx-fae') {
    localStorage.removeItem(`mock-data-cleared-${currentPrincipal}`);
  } else {
    localStorage.removeItem('mock-data-cleared');
  }
}

/**
 * Get mock data cleared flag for current principal
 */
export function isMockDataCleared(): boolean {
  if (currentPrincipal && currentPrincipal !== '2vxsx-fae') {
    return localStorage.getItem(`mock-data-cleared-${currentPrincipal}`) === 'true';
  }
  return localStorage.getItem('mock-data-cleared') === 'true';
}

/**
 * Set mock data cleared flag for current principal
 */
export function setMockDataCleared(cleared: boolean): void {
  const key = currentPrincipal && currentPrincipal !== '2vxsx-fae'
    ? `mock-data-cleared-${currentPrincipal}`
    : 'mock-data-cleared';
  
  if (cleared) {
    localStorage.setItem(key, 'true');
  } else {
    localStorage.removeItem(key);
  }
}
