/**
 * Data Persistence Module
 * 
 * Handles localStorage persistence with schema versioning and migration
 */

import { type Store } from './dataModel';

const STORAGE_KEY = 'crypto-portfolio-store';
const SCHEMA_VERSION = 1;

interface PersistedData {
  version: number;
  timestamp: number;
  store: Store;
}

/**
 * Save the entire store to localStorage
 */
export function saveStore(store: Store): void {
  try {
    const data: PersistedData = {
      version: SCHEMA_VERSION,
      timestamp: Date.now(),
      store,
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data: PersistedData = JSON.parse(stored);
    
    // Validate schema
    if (!validateSchema(data)) {
      console.warn('Invalid schema detected, clearing corrupted data');
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Migrate if needed
    if (data.version !== SCHEMA_VERSION) {
      const migrated = migrateSchema(data.store, data.version, SCHEMA_VERSION);
      return migrated;
    }

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
 * Clear all persisted data
 */
export function clearPersistedData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear persisted data:', error);
  }
}

/**
 * Check if persisted data exists
 */
export function hasPersistedData(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
