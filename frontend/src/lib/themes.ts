/**
 * Advanced Theme System
 * 
 * Provides predefined themes with customizable hue adjustment
 */

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
  baseHue: number; // Default hue for this theme
}

export const PREDEFINED_THEMES: Record<string, ThemeColors> = {
  'midnight-neon': {
    name: 'Midnight Neon',
    description: 'Deep blue-black base with electric cyan/magenta accents',
    backgrounds: {
      bg0: '#0b0f17',
      bg1: '#111827',
      bg2: '#1f2937',
    },
    text: {
      primary: '#e5e7eb',
      muted: '#9ca3af',
    },
    accents: {
      primary: '#06b6d4', // cyan
      secondary: '#7c3aed', // violet
    },
    status: {
      success: '#22c55e',
      danger: '#ef4444',
      warning: '#f59e0b',
    },
    baseHue: 195, // cyan-violet gradient
  },
  'graphite-lumina': {
    name: 'Graphite Lumina',
    description: 'Charcoal gray base with silver/white luminous accents',
    backgrounds: {
      bg0: '#0a0a0a',
      bg1: '#1a1a1a',
      bg2: '#2a2a2a',
    },
    text: {
      primary: '#f5f5f5',
      muted: '#a3a3a3',
    },
    accents: {
      primary: '#e5e5e5', // silver
      secondary: '#ffffff', // white
    },
    status: {
      success: '#10b981',
      danger: '#f87171',
      warning: '#fbbf24',
    },
    baseHue: 0, // neutral
  },
  'slate-minimal': {
    name: 'Slate Minimal',
    description: 'Cool gray base with subtle blue/teal accents',
    backgrounds: {
      bg0: '#0f172a',
      bg1: '#1e293b',
      bg2: '#334155',
    },
    text: {
      primary: '#e2e8f0',
      muted: '#94a3b8',
    },
    accents: {
      primary: '#0ea5e9', // sky blue
      secondary: '#14b8a6', // teal
    },
    status: {
      success: '#22c55e',
      danger: '#ef4444',
      warning: '#f59e0b',
    },
    baseHue: 200, // blue-teal
  },
  'aurora-mist': {
    name: 'Aurora Mist',
    description: 'Dark purple base with green/pink aurora-like accents',
    backgrounds: {
      bg0: '#1a0b2e',
      bg1: '#2d1b4e',
      bg2: '#3d2b5e',
    },
    text: {
      primary: '#f0e7ff',
      muted: '#b8a7d9',
    },
    accents: {
      primary: '#10b981', // emerald
      secondary: '#ec4899', // pink
    },
    status: {
      success: '#34d399',
      danger: '#f472b6',
      warning: '#fbbf24',
    },
    baseHue: 280, // purple
  },
  'velvet-dusk': {
    name: 'Velvet Dusk',
    description: 'Rich burgundy base with gold/amber accents',
    backgrounds: {
      bg0: '#1a0a0f',
      bg1: '#2d1520',
      bg2: '#3d2530',
    },
    text: {
      primary: '#ffe7f0',
      muted: '#d9a7b8',
    },
    accents: {
      primary: '#f59e0b', // amber
      secondary: '#eab308', // yellow
    },
    status: {
      success: '#84cc16',
      danger: '#dc2626',
      warning: '#f97316',
    },
    baseHue: 340, // burgundy
  },
  'carbon-shadow': {
    name: 'Carbon Shadow',
    description: 'Pure black base with red/orange ember accents',
    backgrounds: {
      bg0: '#000000',
      bg1: '#0a0a0a',
      bg2: '#1a1a1a',
    },
    text: {
      primary: '#fafafa',
      muted: '#a3a3a3',
    },
    accents: {
      primary: '#dc2626', // red
      secondary: '#f97316', // orange
    },
    status: {
      success: '#22c55e',
      danger: '#ef4444',
      warning: '#f59e0b',
    },
    baseHue: 10, // red-orange
  },
  'ocean-flux': {
    name: 'Ocean Flux',
    description: 'Deep navy base with aqua/turquoise accents',
    backgrounds: {
      bg0: '#001a2e',
      bg1: '#002a4e',
      bg2: '#003a6e',
    },
    text: {
      primary: '#e0f2fe',
      muted: '#7dd3fc',
    },
    accents: {
      primary: '#06b6d4', // cyan
      secondary: '#14b8a6', // teal
    },
    status: {
      success: '#10b981',
      danger: '#f87171',
      warning: '#fbbf24',
    },
    baseHue: 190, // cyan-teal
  },
  'ember-glow': {
    name: 'Ember Glow',
    description: 'Dark brown base with orange/yellow fire accents',
    backgrounds: {
      bg0: '#1a0f0a',
      bg1: '#2d1f15',
      bg2: '#3d2f25',
    },
    text: {
      primary: '#fff7ed',
      muted: '#d9c7b8',
    },
    accents: {
      primary: '#f97316', // orange
      secondary: '#eab308', // yellow
    },
    status: {
      success: '#84cc16',
      danger: '#dc2626',
      warning: '#f59e0b',
    },
    baseHue: 30, // orange-yellow
  },
};

export interface ThemeSettings {
  selectedTheme: string;
  hueAdjustment: number; // -180 to +180 degrees
}

const THEME_SETTINGS_KEY = 'crypto-portfolio-theme-settings';

const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  selectedTheme: 'midnight-neon',
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

/**
 * Convert hex color to HSL
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
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
 * Adjust hue of a hex color
 */
function adjustHue(hex: string, hueShift: number): string {
  const hsl = hexToHSL(hex);
  let newHue = (hsl.h + hueShift) % 360;
  if (newHue < 0) newHue += 360;

  // Convert back to hex
  const h = newHue / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Apply theme to document root
 */
export function applyTheme(themeName: string, hueAdjustment: number): void {
  const theme = PREDEFINED_THEMES[themeName];
  if (!theme) {
    console.error(`Theme "${themeName}" not found`);
    return;
  }

  const root = document.documentElement;

  // Apply background colors
  root.style.setProperty('--bg0', theme.backgrounds.bg0);
  root.style.setProperty('--bg1', theme.backgrounds.bg1);
  root.style.setProperty('--bg2', theme.backgrounds.bg2);

  // Apply text colors
  root.style.setProperty('--text-primary', theme.text.primary);
  root.style.setProperty('--text-muted', theme.text.muted);

  // Apply accent colors with hue adjustment
  const adjustedPrimary = adjustHue(theme.accents.primary, hueAdjustment);
  const adjustedSecondary = adjustHue(theme.accents.secondary, hueAdjustment);

  root.style.setProperty('--accent-cyan', adjustedPrimary);
  root.style.setProperty('--accent-violet', adjustedSecondary);

  // Apply status colors
  root.style.setProperty('--success', theme.status.success);
  root.style.setProperty('--danger', theme.status.danger);
  root.style.setProperty('--warning', theme.status.warning);

  // Update body background gradient
  const bg0 = theme.backgrounds.bg0;
  const bg1 = theme.backgrounds.bg1;
  const bg2 = theme.backgrounds.bg2;
  
  document.body.style.background = `linear-gradient(180deg, ${bg0} 0%, ${bg1} 50%, ${bg2} 70%, ${bg1} 100%)`;

  console.log(`Applied theme: ${theme.name} with hue adjustment: ${hueAdjustment}°`);
}

/**
 * Get preview color for theme selector
 */
export function getThemePreviewColors(themeName: string, hueAdjustment: number): {
  primary: string;
  secondary: string;
  background: string;
} {
  const theme = PREDEFINED_THEMES[themeName];
  if (!theme) {
    return {
      primary: '#06b6d4',
      secondary: '#7c3aed',
      background: '#111827',
    };
  }

  return {
    primary: adjustHue(theme.accents.primary, hueAdjustment),
    secondary: adjustHue(theme.accents.secondary, hueAdjustment),
    background: theme.backgrounds.bg1,
  };
}
