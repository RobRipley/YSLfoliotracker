/**
 * Category Expand/Collapse State Persistence
 * 
 * Stores per-user category expand/collapse preferences in localStorage.
 * Keyed by principal to ensure isolation between users.
 */

import { type Category } from './dataModel';

const STORAGE_KEY_PREFIX = 'yslfolio:categoryState';

export interface CategoryExpandState {
  expandedCategories: Category[];
  updatedAt: number;
}

/**
 * Get the storage key for a specific principal
 */
function getStorageKey(principal: string | null): string {
  if (principal && principal !== '2vxsx-fae') {
    return `${STORAGE_KEY_PREFIX}:${principal}`;
  }
  return STORAGE_KEY_PREFIX;
}

/**
 * Load category expand state from localStorage
 * Returns null if no state exists (first load)
 */
export function loadCategoryExpandState(principal: string | null): CategoryExpandState | null {
  try {
    const key = getStorageKey(principal);
    const stored = localStorage.getItem(key);
    if (!stored) {
      return null;
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate structure
    if (!parsed || !Array.isArray(parsed.expandedCategories)) {
      console.warn('[CategoryState] Invalid stored state, clearing');
      localStorage.removeItem(key);
      return null;
    }
    
    return parsed as CategoryExpandState;
  } catch (error) {
    console.error('[CategoryState] Failed to load:', error);
    return null;
  }
}

/**
 * Save category expand state to localStorage
 */
export function saveCategoryExpandState(
  principal: string | null, 
  expandedCategories: Category[]
): void {
  try {
    const key = getStorageKey(principal);
    const state: CategoryExpandState = {
      expandedCategories,
      updatedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('[CategoryState] Failed to save:', error);
  }
}

/**
 * Clear category expand state for a principal
 */
export function clearCategoryExpandState(principal: string | null): void {
  try {
    const key = getStorageKey(principal);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[CategoryState] Failed to clear:', error);
  }
}

/**
 * Get default expanded categories (all expanded on first load)
 */
export function getDefaultExpandedCategories(): Category[] {
  return ['stablecoin', 'blue-chip', 'mid-cap', 'low-cap', 'micro-cap', 'defi'];
}
