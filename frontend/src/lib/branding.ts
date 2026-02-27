/**
 * Branding System
 *
 * Single brand: "Onchain Portfolio Tracker" with Rumi-style emerald/purple palette.
 * Brand config applies CSS custom properties at runtime.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrandingMode = 'neutral';

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
// Brand Definition
// ---------------------------------------------------------------------------

export const NEUTRAL_BRAND: BrandConfig = {
  mode: 'neutral',
  appName: 'Onchain Portfolio Tracker',
  navTitle: 'RUMI',
  landingH1: 'Onchain Portfolio Tracker',
  logoSrc: '/rumi-logo-inset.png',
  logoAlt: 'Onchain Portfolio Tracker',
  gradientFrom: '#34d399',   // Rumi Emerald Action
  gradientTo: '#d176e8',     // Rumi Purple Accent
  glowFrom: 'rgba(52, 211, 153, 0.12)',
  glowTo: 'rgba(209, 118, 232, 0.08)',
};

// ---------------------------------------------------------------------------
// Persistence (kept for API compatibility, always returns neutral)
// ---------------------------------------------------------------------------

export function loadBrandingMode(): BrandingMode {
  return 'neutral';
}

export function saveBrandingMode(_mode: BrandingMode): void {
  // No-op — single brand mode
}

// ---------------------------------------------------------------------------
// Active Brand
// ---------------------------------------------------------------------------

export function getActiveBrand(): BrandConfig {
  return NEUTRAL_BRAND;
}

// ---------------------------------------------------------------------------
// CSS Application
// ---------------------------------------------------------------------------

export function applyBrandCSS(brand?: BrandConfig): void {
  const b = brand ?? NEUTRAL_BRAND;
  const root = document.documentElement;
  root.style.setProperty('--brand-gradient-from', b.gradientFrom);
  root.style.setProperty('--brand-gradient-to', b.gradientTo);
  root.style.setProperty('--brand-glow-from', b.glowFrom);
  root.style.setProperty('--brand-glow-to', b.glowTo);
}

export function applyBrandTitle(brand?: BrandConfig): void {
  const b = brand ?? NEUTRAL_BRAND;
  document.title = b.appName;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', b.appName);
}

// ---------------------------------------------------------------------------
// Set Mode (save + apply + notify)
// ---------------------------------------------------------------------------

export function setBrandingMode(_mode: BrandingMode): BrandConfig {
  const brand = NEUTRAL_BRAND;
  applyBrandCSS(brand);
  applyBrandTitle(brand);
  window.dispatchEvent(new CustomEvent('brandingChanged', { detail: brand }));
  return brand;
}
