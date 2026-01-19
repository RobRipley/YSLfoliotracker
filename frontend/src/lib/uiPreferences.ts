/**
 * UI Preferences Module
 * 
 * Handles localStorage persistence for UI-specific preferences
 */

const UI_PREFS_KEY = 'crypto-portfolio-ui-prefs';

export interface UIPreferences {
  overviewMode: boolean;
  tableDensity: 'compact' | 'comfortable' | 'spacious';
  hiddenColumns: string[];
  sidebarWidth: number;
}

const DEFAULT_PREFERENCES: UIPreferences = {
  overviewMode: true, // Default to overview mode
  tableDensity: 'compact',
  hiddenColumns: [],
  sidebarWidth: 400
};

/**
 * Load UI preferences from localStorage
 */
export function loadUIPreferences(): UIPreferences {
  try {
    const stored = localStorage.getItem(UI_PREFS_KEY);
    if (!stored) return { ...DEFAULT_PREFERENCES };
    
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch (error) {
    console.error('Failed to load UI preferences:', error);
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Save UI preferences to localStorage
 */
export function saveUIPreferences(prefs: UIPreferences): void {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error('Failed to save UI preferences:', error);
  }
}

/**
 * Clear UI preferences
 */
export function clearUIPreferences(): void {
  try {
    localStorage.removeItem(UI_PREFS_KEY);
  } catch (error) {
    console.error('Failed to clear UI preferences:', error);
  }
}

