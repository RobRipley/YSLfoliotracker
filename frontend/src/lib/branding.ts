/**
 * Branding System
 *
 * Supports two brand modes:
 * - 'neutral': Default. "Onchain Portfolio Tracker" with Rumi-style emerald/purple palette.
 * - 'yieldschool': Legacy. "Yieldschool Portfolio Tracker" with cyan/violet palette.
 *
 * Admin can toggle via Settings > Admin > Tools.
 * Brand state persists in localStorage and applies CSS custom properties at runtime.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrandingMode = 'neutral' | 'yieldschool';

export interface BrandConfig {
  mode: BrandingMode;
  appName: string;        // Full app title (HTML <title>, OG)
  navTitle: string;       // Navbar brand text
  landingH1: string;      // Landing page hero heading
  logoSrc: string;        // Path to logo in /public
  logoAlt: string;        // Logo alt text
  gradientFrom: string;   // Left/start gradient color (hex)
  gradientTo: string;     // Right/end gradient color (hex)
  glowFrom: string;       // Hover glow shadow color (rgba)
  glowTo: string;         // Hover glow shadow color (rgba)
}

// ---------------------------------------------------------------------------
// Brand Definitions
// ---------------------------------------------------------------------------

export const NEUTRAL_BRAND: BrandConfig = {
  mode: 'neutral',
  appName: 'Onchain Portfolio Tracker',
  navTitle: 'Portfolio Tracker',
  landingH1: 'Onchain Portfolio Tracker',
  logoSrc: '/rumi-logo-inset.svg',
  logoAlt: 'Onchain Portfolio Tracker',
  gradientFrom: '#34d399',   // Rumi Emerald Action
  gradientTo: '#d176e8',     // Rumi Purple Accent
  glowFrom: 'rgba(52, 211, 153, 0.12)',
  glowTo: 'rgba(209, 118, 232, 0.08)',
};

export const YIELDSCHOOL_BRAND: BrandConfig = {
  mode: 'yieldschool',
  appName: 'Yieldschool Portfolio Tracker',
  navTitle: 'Yieldschool',
  landingH1: 'Yieldschool Portfolio Tracker',
  logoSrc: '/yieldschool-logo.jpeg',
  logoAlt: 'Yieldschool',
  gradientFrom: '#06b6d4',   // Cyan
  gradientTo: '#7c3aed',     // Violet
  glowFrom: 'rgba(6, 182, 212, 0.12)',
  glowTo: 'rgba(124, 58, 237, 0.08)',
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const BRANDING_STORAGE_KEY = 'crypto-portfolio-branding-mode';

export function loadBrandingMode(): BrandingMode {
  try {
    const stored = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (stored === 'yieldschool') return 'yieldschool';
  } catch {
    // Ignore localStorage errors
  }
  return 'neutral';
}

export function saveBrandingMode(mode: BrandingMode): void {
  try {
    localStorage.setItem(BRANDING_STORAGE_KEY, mode);
  } catch {
    console.warn('[Branding] Failed to save branding mode');
  }
}

// ---------------------------------------------------------------------------
// Active Brand
// ---------------------------------------------------------------------------

export function getActiveBrand(): BrandConfig {
  return loadBrandingMode() === 'yieldschool' ? YIELDSCHOOL_BRAND : NEUTRAL_BRAND;
}

// ---------------------------------------------------------------------------
// CSS Application
// ---------------------------------------------------------------------------

export function applyBrandCSS(brand?: BrandConfig): void {
  const b = brand ?? getActiveBrand();
  const root = document.documentElement;
  root.style.setProperty('--brand-gradient-from', b.gradientFrom);
  root.style.setProperty('--brand-gradient-to', b.gradientTo);
  root.style.setProperty('--brand-glow-from', b.glowFrom);
  root.style.setProperty('--brand-glow-to', b.glowTo);
}

export function applyBrandTitle(brand?: BrandConfig): void {
  const b = brand ?? getActiveBrand();
  document.title = b.appName;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', b.appName);
}

// ---------------------------------------------------------------------------
// Set Mode (save + apply + notify)
// ---------------------------------------------------------------------------

export function setBrandingMode(mode: BrandingMode): BrandConfig {
  saveBrandingMode(mode);
  const brand = mode === 'yieldschool' ? YIELDSCHOOL_BRAND : NEUTRAL_BRAND;
  applyBrandCSS(brand);
  applyBrandTitle(brand);
  window.dispatchEvent(new CustomEvent('brandingChanged', { detail: brand }));
  return brand;
}
