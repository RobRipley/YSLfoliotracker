/**
 * Centralized category color mapping for consistent colors across the app.
 * Use this single source of truth for all category-related colors.
 * 
 * Color Philosophy:
 * - Cash: Neutral slate/gray (intentionally off-spectrum, not a "risk bucket")
 * - Stablecoins: Teal (distinct from cash)
 * - Blue Chip: Blue (not cyan, to distinguish from teal)
 * - Mid Cap: Purple
 * - Low Cap: Amber/Yellow
 * - Micro Cap: Orange/Red-orange
 * - DeFi: Violet
 */

import { type Category } from '@/lib/dataModel';

// Extended category type that includes 'cash' as a special case
export type ExtendedCategory = Category | 'cash';

/**
 * Primary category colors - use these for donut slices, legend dots, and badges
 */
export const CATEGORY_COLORS: Record<ExtendedCategory, string> = {
  'cash': '#64748b',        // Slate-500 - neutral gray, clearly different from risk categories
  'stablecoin': '#14b8a6',  // Teal-500 - distinct teal
  'blue-chip': '#3b82f6',   // Blue-500 - clear blue, NOT cyan
  'mid-cap': '#a855f7',     // Purple-500
  'low-cap': '#eab308',     // Yellow-500 - amber/gold
  'micro-cap': '#f97316',   // Orange-500
  'defi': '#8b5cf6',        // Violet-500
};

/**
 * Accent colors for hover states and highlights
 */
export const CATEGORY_ACCENT_COLORS: Record<ExtendedCategory, string> = {
  'cash': '#94a3b8',        // Slate-400
  'stablecoin': '#2dd4bf',  // Teal-400
  'blue-chip': '#60a5fa',   // Blue-400
  'mid-cap': '#c084fc',     // Purple-400
  'low-cap': '#facc15',     // Yellow-400
  'micro-cap': '#fb923c',   // Orange-400
  'defi': '#a78bfa',        // Violet-400
};

/**
 * Category labels for display
 */
export const CATEGORY_LABELS: Record<ExtendedCategory, string> = {
  'cash': 'Cash',
  'stablecoin': 'Stablecoins',
  'blue-chip': 'Blue Chip',
  'mid-cap': 'Mid Cap',
  'low-cap': 'Low Cap',
  'micro-cap': 'Micro Cap',
  'defi': 'DeFi',
};

/**
 * Display order for legends and lists
 */
export const CATEGORY_ORDER: ExtendedCategory[] = [
  'cash',
  'stablecoin',
  'blue-chip',
  'mid-cap',
  'low-cap',
  'micro-cap',
  'defi',
];

/**
 * Gradient backgrounds for category headers/rows
 */
export const CATEGORY_GRADIENTS: Record<ExtendedCategory, string> = {
  'cash': 'linear-gradient(135deg, rgba(100,116,139,0.2), rgba(100,116,139,0.05))',
  'stablecoin': 'linear-gradient(135deg, rgba(20,184,166,0.2), rgba(20,184,166,0.05))',
  'blue-chip': 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))',
  'mid-cap': 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.05))',
  'low-cap': 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.05))',
  'micro-cap': 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(249,115,22,0.05))',
  'defi': 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))',
};

/**
 * Background colors with transparency for cards/panels
 */
export const CATEGORY_BG_COLORS: Record<ExtendedCategory, string> = {
  'cash': 'rgba(100, 116, 139, 0.08)',
  'stablecoin': 'rgba(20, 184, 166, 0.08)',
  'blue-chip': 'rgba(59, 130, 246, 0.08)',
  'mid-cap': 'rgba(168, 85, 247, 0.08)',
  'low-cap': 'rgba(234, 179, 8, 0.08)',
  'micro-cap': 'rgba(249, 115, 22, 0.08)',
  'defi': 'rgba(139, 92, 246, 0.08)',
};

/**
 * Border colors with transparency
 */
export const CATEGORY_BORDER_COLORS: Record<ExtendedCategory, string> = {
  'cash': 'rgba(100, 116, 139, 0.3)',
  'stablecoin': 'rgba(20, 184, 166, 0.3)',
  'blue-chip': 'rgba(59, 130, 246, 0.3)',
  'mid-cap': 'rgba(168, 85, 247, 0.3)',
  'low-cap': 'rgba(234, 179, 8, 0.3)',
  'micro-cap': 'rgba(249, 115, 22, 0.3)',
  'defi': 'rgba(139, 92, 246, 0.3)',
};

/**
 * Ring/glow colors for selected states
 */
export const CATEGORY_RING_COLORS: Record<ExtendedCategory, string> = {
  'cash': 'rgba(100, 116, 139, 0.12)',
  'stablecoin': 'rgba(20, 184, 166, 0.12)',
  'blue-chip': 'rgba(59, 130, 246, 0.12)',
  'mid-cap': 'rgba(168, 85, 247, 0.12)',
  'low-cap': 'rgba(234, 179, 8, 0.12)',
  'micro-cap': 'rgba(249, 115, 22, 0.12)',
  'defi': 'rgba(139, 92, 246, 0.12)',
};

/**
 * Helper function to get color for a category
 */
export function getCategoryColor(category: ExtendedCategory): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['micro-cap'];
}

/**
 * Helper function to get accent color for a category
 */
export function getCategoryAccentColor(category: ExtendedCategory): string {
  return CATEGORY_ACCENT_COLORS[category] || CATEGORY_ACCENT_COLORS['micro-cap'];
}

/**
 * Helper function to get label for a category
 */
export function getCategoryLabel(category: ExtendedCategory): string {
  return CATEGORY_LABELS[category] || category;
}
