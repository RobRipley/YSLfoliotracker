/**
 * Advanced Theme System with Collections
 * 
 * 24 themes organized into 3 collections:
 * - Luminous Dark (8 themes)
 * - Radiant Spectrum (8 themes)
 * - Elemental Essence (8 themes)
 * 
 * Each theme defines colors for:
 * - Background
 * - Accent
 * - Buttons
 * - Text
 * - Glow
 */

export interface ThemeDefinition {
  id: string;
  name: string;
  colors: {
    background: string;
    accent: string;
    buttons: string;
    text: string;
    glow: string;
  };
}

export interface ThemeCollection {
  id: string;
  name: string;
  themes: ThemeDefinition[];
}

// =============================================================================
// THEME COLLECTIONS DATA (24 themes total)
// =============================================================================

export const THEME_COLLECTIONS: ThemeCollection[] = [
  {
    id: 'luminous-dark',
    name: 'Luminous Dark',
    themes: [
      {
        id: 'midnight-neon',
        name: 'Midnight Neon',
        colors: {
          background: '#0b0f17',
          accent: '#06b6d4',
          buttons: '#7c3aed',
          text: '#e5e7eb',
          glow: '#06b6d4',
        },
      },
      {
        id: 'carbon-shadow',
        name: 'Carbon Shadow',
        colors: {
          background: '#0a0a0a',
          accent: '#dc2626',
          buttons: '#f97316',
          text: '#fafafa',
          glow: '#ef4444',
        },
      },
      {
        id: 'obsidian-pulse',
        name: 'Obsidian Pulse',
        colors: {
          background: '#0f0f12',
          accent: '#8b5cf6',
          buttons: '#a855f7',
          text: '#f4f4f5',
          glow: '#a78bfa',
        },
      },
      {
        id: 'deep-space',
        name: 'Deep Space',
        colors: {
          background: '#030712',
          accent: '#3b82f6',
          buttons: '#6366f1',
          text: '#e2e8f0',
          glow: '#60a5fa',
        },
      },
      {
        id: 'void-ember',
        name: 'Void Ember',
        colors: {
          background: '#0c0a09',
          accent: '#ea580c',
          buttons: '#f97316',
          text: '#fafaf9',
          glow: '#fb923c',
        },
      },
      {
        id: 'shadow-mint',
        name: 'Shadow Mint',
        colors: {
          background: '#0a0f0d',
          accent: '#10b981',
          buttons: '#14b8a6',
          text: '#ecfdf5',
          glow: '#34d399',
        },
      },
      {
        id: 'dark-rose',
        name: 'Dark Rose',
        colors: {
          background: '#0f0a0c',
          accent: '#ec4899',
          buttons: '#f472b6',
          text: '#fdf2f8',
          glow: '#f472b6',
        },
      },
      {
        id: 'onyx-gold',
        name: 'Onyx Gold',
        colors: {
          background: '#0c0a07',
          accent: '#eab308',
          buttons: '#fbbf24',
          text: '#fefce8',
          glow: '#facc15',
        },
      },
    ],
  },
  {
    id: 'radiant-spectrum',
    name: 'Radiant Spectrum',
    themes: [
      {
        id: 'aurora-mist',
        name: 'Aurora Mist',
        colors: {
          background: '#1a0b2e',
          accent: '#10b981',
          buttons: '#ec4899',
          text: '#f0e7ff',
          glow: '#34d399',
        },
      },
      {
        id: 'velvet-dusk',
        name: 'Velvet Dusk',
        colors: {
          background: '#1a0a0f',
          accent: '#f59e0b',
          buttons: '#eab308',
          text: '#ffe7f0',
          glow: '#fbbf24',
        },
      },
      {
        id: 'neon-twilight',
        name: 'Neon Twilight',
        colors: {
          background: '#1a0f2e',
          accent: '#f43f5e',
          buttons: '#ec4899',
          text: '#faf5ff',
          glow: '#fb7185',
        },
      },
      {
        id: 'cyber-jungle',
        name: 'Cyber Jungle',
        colors: {
          background: '#0a1f1a',
          accent: '#22c55e',
          buttons: '#06b6d4',
          text: '#f0fdf4',
          glow: '#4ade80',
        },
      },
      {
        id: 'electric-sunset',
        name: 'Electric Sunset',
        colors: {
          background: '#1f0a0a',
          accent: '#f97316',
          buttons: '#ef4444',
          text: '#fff7ed',
          glow: '#fb923c',
        },
      },
      {
        id: 'plasma-wave',
        name: 'Plasma Wave',
        colors: {
          background: '#0f1a2e',
          accent: '#06b6d4',
          buttons: '#8b5cf6',
          text: '#ecfeff',
          glow: '#22d3ee',
        },
      },
      {
        id: 'toxic-bloom',
        name: 'Toxic Bloom',
        colors: {
          background: '#0f1a0f',
          accent: '#84cc16',
          buttons: '#22c55e',
          text: '#f7fee7',
          glow: '#a3e635',
        },
      },
      {
        id: 'royal-amethyst',
        name: 'Royal Amethyst',
        colors: {
          background: '#1a0f2a',
          accent: '#a855f7',
          buttons: '#7c3aed',
          text: '#faf5ff',
          glow: '#c084fc',
        },
      },
    ],
  },
  {
    id: 'elemental-essence',
    name: 'Elemental Essence',
    themes: [
      {
        id: 'slate-minimal',
        name: 'Slate Minimal',
        colors: {
          background: '#0f172a',
          accent: '#0ea5e9',
          buttons: '#14b8a6',
          text: '#e2e8f0',
          glow: '#38bdf8',
        },
      },
      {
        id: 'ocean-flux',
        name: 'Ocean Flux',
        colors: {
          background: '#001a2e',
          accent: '#06b6d4',
          buttons: '#14b8a6',
          text: '#e0f2fe',
          glow: '#22d3ee',
        },
      },
      {
        id: 'ember-glow',
        name: 'Ember Glow',
        colors: {
          background: '#1a0f0a',
          accent: '#f97316',
          buttons: '#eab308',
          text: '#fff7ed',
          glow: '#fb923c',
        },
      },
      {
        id: 'graphite-lumina',
        name: 'Graphite Lumina',
        colors: {
          background: '#0a0a0a',
          accent: '#e5e5e5',
          buttons: '#a3a3a3',
          text: '#f5f5f5',
          glow: '#ffffff',
        },
      },
      {
        id: 'forest-mist',
        name: 'Forest Mist',
        colors: {
          background: '#0a1510',
          accent: '#22c55e',
          buttons: '#10b981',
          text: '#dcfce7',
          glow: '#4ade80',
        },
      },
      {
        id: 'arctic-steel',
        name: 'Arctic Steel',
        colors: {
          background: '#0f1419',
          accent: '#94a3b8',
          buttons: '#64748b',
          text: '#f1f5f9',
          glow: '#cbd5e1',
        },
      },
      {
        id: 'volcanic-ash',
        name: 'Volcanic Ash',
        colors: {
          background: '#1a1412',
          accent: '#ef4444',
          buttons: '#dc2626',
          text: '#fef2f2',
          glow: '#f87171',
        },
      },
      {
        id: 'copper-patina',
        name: 'Copper Patina',
        colors: {
          background: '#0f1514',
          accent: '#14b8a6',
          buttons: '#0d9488',
          text: '#f0fdfa',
          glow: '#2dd4bf',
        },
      },
    ],
  },
];

// Create a flat lookup map for quick access
export const THEME_MAP: Map<string, ThemeDefinition> = new Map();
THEME_COLLECTIONS.forEach(collection => {
  collection.themes.forEach(theme => {
    THEME_MAP.set(theme.id, theme);
  });
});

// =============================================================================
// LEGACY COMPATIBILITY - Keep old PREDEFINED_THEMES structure for backward compat
// =============================================================================

export interface ThemeColors {
  name: string;
  description: string;
  backgrounds: {
    bg0: string;
    bg1: string;
    bg2: string;
  };
  text: {
    primary: string;
    muted: string;
  };
  accents: {
    primary: string;
    secondary: string;
  };
  status: {
    success: string;
    danger: string;
    warning: string;
  };
  baseHue: number;
}

// Generate legacy format from new themes
function generateLegacyTheme(theme: ThemeDefinition): ThemeColors {
  const bg = theme.colors.background;
  const lighterBg1 = lightenHex(bg, 0.03);
  const lighterBg2 = lightenHex(bg, 0.06);
  const mutedText = adjustAlpha(theme.colors.text, 0.6);
  
  return {
    name: theme.name,
    description: `${theme.name} theme`,
    backgrounds: {
      bg0: bg,
      bg1: lighterBg1,
      bg2: lighterBg2,
    },
    text: {
      primary: theme.colors.text,
      muted: mutedText,
    },
    accents: {
      primary: theme.colors.accent,
      secondary: theme.colors.buttons,
    },
    status: {
      success: '#22c55e',
      danger: '#ef4444',
      warning: '#f59e0b',
    },
    baseHue: hexToHSL(theme.colors.accent).h,
  };
}

// Build PREDEFINED_THEMES from collections
export const PREDEFINED_THEMES: Record<string, ThemeColors> = {};
THEME_COLLECTIONS.forEach(collection => {
  collection.themes.forEach(theme => {
    PREDEFINED_THEMES[theme.id] = generateLegacyTheme(theme);
  });
});

// =============================================================================
// THEME SETTINGS
// =============================================================================

export interface ThemeSettings {
  selectedTheme: string;
  selectedCollection: string;
  hueAdjustment: number; // -180 to +180 degrees
}

const THEME_SETTINGS_KEY = 'crypto-portfolio-theme-settings';

const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  selectedTheme: 'midnight-neon',
  selectedCollection: 'luminous-dark',
  hueAdjustment: 0,
};

/**
 * Load theme settings from localStorage
 */
export function loadThemeSettings(): ThemeSettings {
  try {
    const stored = localStorage.getItem(THEME_SETTINGS_KEY);
    if (!stored) return { ...DEFAULT_THEME_SETTINGS };
    
    const parsed = JSON.parse(stored);
    // Migration: add selectedCollection if missing
    if (!parsed.selectedCollection) {
      const foundCollection = THEME_COLLECTIONS.find(c => 
        c.themes.some(t => t.id === parsed.selectedTheme)
      );
      parsed.selectedCollection = foundCollection?.id || 'luminous-dark';
    }
    return { ...DEFAULT_THEME_SETTINGS, ...parsed };
  } catch (error) {
    console.error('Failed to load theme settings:', error);
    return { ...DEFAULT_THEME_SETTINGS };
  }
}

/**
 * Save theme settings to localStorage
 */
export function saveThemeSettings(settings: ThemeSettings): void {
  try {
    localStorage.setItem(THEME_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save theme settings:', error);
  }
}

// =============================================================================
// COLOR MANIPULATION UTILITIES
// =============================================================================

/**
 * Convert hex color to HSL
 */
export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to hex
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  let r, g, b;

  if (sNorm === 0) {
    r = g = b = lNorm;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;

    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Rotate hue of a hex color
 */
export function rotateHue(hex: string, hueShift: number): string {
  const hsl = hexToHSL(hex);
  let newHue = (hsl.h + hueShift) % 360;
  if (newHue < 0) newHue += 360;
  return hslToHex(newHue, hsl.s, hsl.l);
}

/**
 * Lighten a hex color by a factor (0-1)
 */
function lightenHex(hex: string, factor: number): string {
  const hsl = hexToHSL(hex);
  const newL = Math.min(100, hsl.l + (100 - hsl.l) * factor);
  return hslToHex(hsl.h, hsl.s, newL);
}

/**
 * Create a muted version of a color (reduce saturation and lightness)
 */
function adjustAlpha(hex: string, factor: number): string {
  const hsl = hexToHSL(hex);
  // Reduce lightness to simulate lower opacity on dark bg
  const newL = hsl.l * factor + (1 - factor) * 15;
  return hslToHex(hsl.h, hsl.s * 0.8, newL);
}

/**
 * Convert hex to HSL CSS string
 */
function hexToHSLCSSValue(hex: string): string {
  const hsl = hexToHSL(hex);
  return `${Math.round(hsl.h)} ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`;
}

// =============================================================================
// THEME APPLICATION
// =============================================================================

/**
 * Apply theme to document root with hue adjustment
 */
export function applyTheme(themeId: string, hueShift: number): void {
  const theme = THEME_MAP.get(themeId);
  if (!theme) {
    console.error(`Theme "${themeId}" not found`);
    return;
  }

  const root = document.documentElement;
  const colors = theme.colors;

  // Apply hue rotation to accent colors (keep text mostly unshifted)
  const adjustedAccent = rotateHue(colors.accent, hueShift);
  const adjustedButtons = rotateHue(colors.buttons, hueShift);
  const adjustedGlow = rotateHue(colors.glow, hueShift);
  // Slight shift for background to maintain cohesion
  const adjustedBg = rotateHue(colors.background, hueShift * 0.3);
  
  // Generate background gradient colors
  const bg0 = adjustedBg;
  const bg1 = lightenHex(adjustedBg, 0.03);
  const bg2 = lightenHex(adjustedBg, 0.06);
  
  // Set CSS custom properties using HSL format for Tailwind compatibility
  root.style.setProperty('--background', hexToHSLCSSValue(bg0));
  root.style.setProperty('--background-gradient-start', hexToHSLCSSValue(bg0));
  root.style.setProperty('--background-gradient-end', hexToHSLCSSValue(bg1));
  
  root.style.setProperty('--foreground', hexToHSLCSSValue(colors.text));
  
  root.style.setProperty('--card', hexToHSLCSSValue(bg1));
  root.style.setProperty('--card-foreground', hexToHSLCSSValue(colors.text));
  
  root.style.setProperty('--popover', hexToHSLCSSValue(bg1));
  root.style.setProperty('--popover-foreground', hexToHSLCSSValue(colors.text));
  
  root.style.setProperty('--primary', hexToHSLCSSValue(adjustedAccent));
  root.style.setProperty('--primary-foreground', hexToHSLCSSValue(colors.text));
  
  root.style.setProperty('--secondary', hexToHSLCSSValue(bg2));
  root.style.setProperty('--secondary-foreground', hexToHSLCSSValue(colors.text));
  
  // Muted colors derived from background
  const mutedBg = lightenHex(adjustedBg, 0.08);
  const mutedText = adjustAlpha(colors.text, 0.6);
  root.style.setProperty('--muted', hexToHSLCSSValue(mutedBg));
  root.style.setProperty('--muted-foreground', hexToHSLCSSValue(mutedText));
  
  root.style.setProperty('--accent', hexToHSLCSSValue(adjustedAccent));
  root.style.setProperty('--accent-foreground', hexToHSLCSSValue(colors.text));
  
  // Border and input colors
  const borderColor = lightenHex(adjustedBg, 0.12);
  root.style.setProperty('--border', hexToHSLCSSValue(borderColor));
  root.style.setProperty('--input', hexToHSLCSSValue(borderColor));
  root.style.setProperty('--ring', hexToHSLCSSValue(adjustedAccent));
  
  // Chart colors
  root.style.setProperty('--chart-1', hexToHSLCSSValue(adjustedAccent));
  root.style.setProperty('--chart-2', hexToHSLCSSValue(adjustedButtons));
  root.style.setProperty('--chart-3', hexToHSLCSSValue(adjustedGlow));
  
  // Legacy custom properties for gradients
  root.style.setProperty('--bg0', bg0);
  root.style.setProperty('--bg1', bg1);
  root.style.setProperty('--bg2', bg2);
  root.style.setProperty('--text-primary', colors.text);
  root.style.setProperty('--text-muted', mutedText);
  root.style.setProperty('--accent-cyan', adjustedAccent);
  root.style.setProperty('--accent-violet', adjustedButtons);
  root.style.setProperty('--glow-color', adjustedGlow);
  
  // Update body background gradient directly
  document.body.style.background = `linear-gradient(180deg, ${bg0} 0%, ${bg1} 50%, ${bg2} 70%, ${bg1} 100%)`;

  console.log(`Applied theme: ${theme.name} with hue adjustment: ${hueShift}°`);
}

/**
 * Get preview colors for theme card display
 */
export function getThemePreviewColors(themeId: string, hueShift: number): {
  primary: string;
  secondary: string;
  background: string;
  glow: string;
  text: string;
} {
  const theme = THEME_MAP.get(themeId);
  if (!theme) {
    return {
      primary: '#06b6d4',
      secondary: '#7c3aed',
      background: '#111827',
      glow: '#06b6d4',
      text: '#e5e7eb',
    };
  }

  return {
    primary: rotateHue(theme.colors.accent, hueShift),
    secondary: rotateHue(theme.colors.buttons, hueShift),
    background: rotateHue(theme.colors.background, hueShift * 0.3),
    glow: rotateHue(theme.colors.glow, hueShift),
    text: theme.colors.text,
  };
}

/**
 * Find which collection a theme belongs to
 */
export function findCollectionForTheme(themeId: string): string {
  for (const collection of THEME_COLLECTIONS) {
    if (collection.themes.some(t => t.id === themeId)) {
      return collection.id;
    }
  }
  return 'luminous-dark';
}
