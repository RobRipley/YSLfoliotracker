/**
 * Exit Strategy Templates
 * 
 * This module provides data types, storage, and management for reusable
 * exit strategy templates that can be applied to assets in the Exit Strategy page.
 */

import type { Category } from './dataModel';

// ============================================================================
// TYPES
// ============================================================================

export interface ExitRung {
  sellPercent: number;   // Percentage of total holdings to sell (0-100)
  multiple: number;      // Price multiple relative to cost basis (e.g., 2 = 2x)
}

export interface ExitStrategyTemplate {
  id: string;
  name: string;
  description?: string;
  targetCategories: Category[];  // Which categories this template is designed for
  exits: ExitRung[];
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;  // Built-in templates that ship with the app
}

// Calculated rung with all derived values (for preview/display)
export interface CalculatedExitRung {
  sellPercent: number;
  multiple: number;
  tokensToSell: number;
  targetPrice: number;
  proceeds: number;
  profit: number;
  isRemaining?: boolean;
}

// ============================================================================
// STORAGE
// ============================================================================

const TEMPLATES_STORAGE_KEY = 'ysl-strategy-templates';

let templateIdCounter = 1;

function generateTemplateId(): string {
  return `template-${Date.now()}-${templateIdCounter++}`;
}

// ============================================================================
// DEFAULT TEMPLATES (Retroactive)
// ============================================================================

/**
 * Blue Chip – Conservative
 * Based on ETH exits pattern: take profits gradually at lower multiples
 * More cautious approach for stable, large-cap assets
 */
const BLUE_CHIP_CONSERVATIVE: ExitStrategyTemplate = {
  id: 'default-blue-chip-conservative',
  name: 'Blue Chip – Conservative',
  description: 'Gradual profit-taking for large-cap assets like ETH. Lower multiples, spread exits.',
  targetCategories: ['blue-chip'],
  exits: [
    { sellPercent: 10, multiple: 1.2 },
    { sellPercent: 20, multiple: 1.4 },
    { sellPercent: 25, multiple: 1.8 },
    { sellPercent: 40, multiple: 2.0 },
    // Remaining 5% calculated automatically
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDefault: true,
};

/**
 * Aggressive
 * Based on ICP exits pattern: hold for higher multiples
 * Suitable for high-conviction plays where you expect significant upside
 */
const AGGRESSIVE: ExitStrategyTemplate = {
  id: 'default-aggressive',
  name: 'Aggressive',
  description: 'Hold for higher multiples. Best for high-conviction mid/low caps like ICP.',
  targetCategories: ['mid-cap', 'low-cap', 'micro-cap'],
  exits: [
    { sellPercent: 10, multiple: 2 },
    { sellPercent: 20, multiple: 3 },
    { sellPercent: 25, multiple: 5 },
    { sellPercent: 40, multiple: 10 },
    // Remaining 5% calculated automatically
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDefault: true,
};

/**
 * Midcap / Low-cap Conservative
 * Based on ENA exits pattern: front-loaded selling at lower multiples
 * Take more profits earlier, keep less for moonshot scenarios
 */
const MIDCAP_LOWCAP_CONSERVATIVE: ExitStrategyTemplate = {
  id: 'default-midcap-lowcap-conservative',
  name: 'Midcap / Low-cap Conservative',
  description: 'Front-loaded profit-taking for smaller caps like ENA. Secure gains early.',
  targetCategories: ['mid-cap', 'low-cap', 'micro-cap'],
  exits: [
    { sellPercent: 40, multiple: 2 },
    { sellPercent: 25, multiple: 3 },
    { sellPercent: 20, multiple: 5 },
    { sellPercent: 10, multiple: 10 },
    // Remaining 5% calculated automatically
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDefault: true,
};

const DEFAULT_TEMPLATES: ExitStrategyTemplate[] = [
  BLUE_CHIP_CONSERVATIVE,
  AGGRESSIVE,
  MIDCAP_LOWCAP_CONSERVATIVE,
];

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Load all templates from localStorage
 * Merges with default templates (defaults are always present)
 */
export function loadTemplates(): ExitStrategyTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ExitStrategyTemplate[];
      
      // Merge: user templates + ensure defaults exist (possibly edited)
      const defaultIds = new Set(DEFAULT_TEMPLATES.map(t => t.id));
      const userTemplates = parsed.filter(t => !t.isDefault);
      const editedDefaults = parsed.filter(t => t.isDefault);
      
      // For each default, use edited version if exists, otherwise use original
      const defaults = DEFAULT_TEMPLATES.map(original => {
        const edited = editedDefaults.find(e => e.id === original.id);
        return edited || original;
      });
      
      return [...defaults, ...userTemplates];
    }
  } catch (e) {
    console.warn('[StrategyTemplates] Failed to load templates:', e);
  }
  
  // First load - return defaults
  return [...DEFAULT_TEMPLATES];
}

/**
 * Save all templates to localStorage
 */
export function saveTemplates(templates: ExitStrategyTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.warn('[StrategyTemplates] Failed to save templates:', e);
  }
}

/**
 * Create a new template
 */
export function createTemplate(
  name: string,
  exits: ExitRung[],
  options?: {
    description?: string;
    targetCategories?: Category[];
  }
): ExitStrategyTemplate {
  const template: ExitStrategyTemplate = {
    id: generateTemplateId(),
    name,
    description: options?.description,
    targetCategories: options?.targetCategories || ['blue-chip', 'mid-cap', 'low-cap', 'micro-cap'],
    exits,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: false,
  };
  
  const templates = loadTemplates();
  templates.push(template);
  saveTemplates(templates);
  
  return template;
}

/**
 * Update an existing template
 */
export function updateTemplate(
  id: string,
  updates: Partial<Omit<ExitStrategyTemplate, 'id' | 'createdAt' | 'isDefault'>>
): ExitStrategyTemplate | null {
  const templates = loadTemplates();
  const index = templates.findIndex(t => t.id === id);
  
  if (index === -1) return null;
  
  templates[index] = {
    ...templates[index],
    ...updates,
    updatedAt: Date.now(),
  };
  
  saveTemplates(templates);
  return templates[index];
}

/**
 * Delete a template
 * Note: Default templates can be "deleted" but will be restored to original on next load
 */
export function deleteTemplate(id: string): boolean {
  const templates = loadTemplates();
  const template = templates.find(t => t.id === id);
  
  if (!template) return false;
  
  // For default templates, we just remove customizations (they'll restore to defaults)
  if (template.isDefault) {
    const filtered = templates.filter(t => t.id !== id);
    // Add back the original default
    const original = DEFAULT_TEMPLATES.find(d => d.id === id);
    if (original) {
      filtered.unshift({ ...original });
    }
    saveTemplates(filtered);
    return true;
  }
  
  // For user templates, actually delete
  const filtered = templates.filter(t => t.id !== id);
  saveTemplates(filtered);
  return true;
}

/**
 * Get a single template by ID
 */
export function getTemplate(id: string): ExitStrategyTemplate | null {
  const templates = loadTemplates();
  return templates.find(t => t.id === id) || null;
}

/**
 * Get templates suitable for a specific category
 */
export function getTemplatesForCategory(category: Category): ExitStrategyTemplate[] {
  const templates = loadTemplates();
  return templates.filter(t => 
    t.targetCategories.length === 0 || t.targetCategories.includes(category)
  );
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Validate exit percentages (must sum to ≤100%)
 */
export function validateExits(exits: ExitRung[]): {
  valid: boolean;
  totalPercent: number;
  remaining: number;
  error?: string;
} {
  const totalPercent = exits.reduce((sum, e) => sum + e.sellPercent, 0);
  const remaining = 100 - totalPercent;
  
  if (totalPercent > 100) {
    return {
      valid: false,
      totalPercent,
      remaining,
      error: `Total sell percentage (${totalPercent}%) exceeds 100%`,
    };
  }
  
  if (exits.some(e => e.sellPercent < 0)) {
    return {
      valid: false,
      totalPercent,
      remaining,
      error: 'Sell percentages cannot be negative',
    };
  }
  
  if (exits.some(e => e.multiple <= 0)) {
    return {
      valid: false,
      totalPercent,
      remaining,
      error: 'Multiples must be greater than 0',
    };
  }
  
  return { valid: true, totalPercent, remaining };
}

/**
 * Calculate full exit matrix with derived values
 */
export function calculateExitMatrix(
  exits: ExitRung[],
  dummyToken: {
    tokensOwned: number;
    avgCost: number;
    planBasis: number;  // Cost basis potentially with cushion
  }
): CalculatedExitRung[] {
  const { tokensOwned, avgCost, planBasis } = dummyToken;
  const validation = validateExits(exits);
  
  const calculated: CalculatedExitRung[] = exits.map(exit => {
    const tokensToSell = (tokensOwned * exit.sellPercent) / 100;
    const targetPrice = planBasis * exit.multiple;
    const proceeds = tokensToSell * targetPrice;
    const costBasis = tokensToSell * avgCost;
    const profit = proceeds - costBasis;
    
    return {
      sellPercent: exit.sellPercent,
      multiple: exit.multiple,
      tokensToSell,
      targetPrice,
      proceeds,
      profit,
    };
  });
  
  // Add remaining row
  if (validation.remaining > 0) {
    const remainingTokens = (tokensOwned * validation.remaining) / 100;
    calculated.push({
      sellPercent: validation.remaining,
      multiple: 0,
      tokensToSell: remainingTokens,
      targetPrice: 0,
      proceeds: 0,
      profit: 0,
      isRemaining: true,
    });
  }
  
  return calculated;
}

/**
 * Get summary statistics for a template
 */
export function getTemplateSummary(
  template: ExitStrategyTemplate,
  dummyToken: {
    tokensOwned: number;
    avgCost: number;
    planBasis: number;
  }
): {
  totalProceeds: number;
  totalProfit: number;
  avgMultiple: number;
  exitCount: number;
} {
  const calculated = calculateExitMatrix(template.exits, dummyToken);
  
  let totalProceeds = 0;
  let totalProfit = 0;
  let weightedMultipleSum = 0;
  let percentSum = 0;
  
  for (const rung of calculated) {
    if (!rung.isRemaining) {
      totalProceeds += rung.proceeds;
      totalProfit += rung.profit;
      weightedMultipleSum += rung.multiple * rung.sellPercent;
      percentSum += rung.sellPercent;
    }
  }
  
  const avgMultiple = percentSum > 0 ? weightedMultipleSum / percentSum : 0;
  
  return {
    totalProceeds,
    totalProfit,
    avgMultiple,
    exitCount: template.exits.length,
  };
}
