# Rebrand Complete: YSLfolioTracker → OnchainFolioTracker

**Date:** February 2026
**Branch:** `rebrand/onchain-folio-tracker`

---

## Summary

Fully removed all YieldSchool/YSL branding from the project. The application is now exclusively "Onchain Portfolio Tracker" — there is no toggle, no legacy brand option, and no remaining YieldSchool visual identity. The default (and only) brand uses Rumi Protocol colors (emerald/purple).

---

## What Changed

### 1. UI Text / Brand Strings

| Location | Before | After |
|----------|--------|-------|
| `frontend/index.html` `<title>` | Yieldschool Portfolio Tracker | Onchain Portfolio Tracker |
| `frontend/index.html` og:title | Yieldschool Portfolio Tracker | Onchain Portfolio Tracker |
| `frontend/src/components/Layout.tsx` navbar | Hardcoded "Yieldschool" + logo | Dynamic `brand.navTitle` + `brand.logoSrc` |
| `frontend/src/pages/Landing.tsx` h1 | "Yieldschool Portfolio Tracker" | Dynamic `brand.landingH1` |
| `frontend/src/pages/SettingsPage.tsx` line ~921 | "YSL Portfolio" | "Portfolio" |

### 2. CSS / Gradient Colors

| Location | Before | After |
|----------|--------|-------|
| `frontend/src/index.css` `:root` | No brand CSS vars | Added `--brand-gradient-from/to`, `--brand-glow-from/to` |
| `frontend/src/index.css` `.gradient-outline-btn` | Hardcoded `#06b6d4` / `#7c3aed` | `var(--brand-gradient-from)` / `var(--brand-gradient-to)` |
| `frontend/src/index.css` `.text-gradient-cyan-violet` | Hardcoded hex colors | CSS custom properties |
| `frontend/src/index.css` | N/A | Added `.text-gradient-brand` and `.bg-gradient-brand` utilities |

**Component gradient replacements (22+ instances):**

| File | Instances | Change |
|------|-----------|--------|
| `Layout.tsx` | 4 | `bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent` → `text-gradient-brand` |
| `Landing.tsx` | 2 | Same pattern → `text-gradient-brand` |
| `ErrorBoundary.tsx` | 1 | Same pattern → `text-gradient-brand` |
| `NamePromptModal.tsx` | 2 | Same pattern → `text-gradient-brand` |
| `QuickActionBar.tsx` | 2 | Same pattern → `text-gradient-brand` |
| `UnifiedAssetModal.tsx` | 3 | Same pattern → `text-gradient-brand` |
| `StrategyLibrary.tsx` | 2 | Same pattern → `text-gradient-brand` |
| `AddAssetDialog.tsx` | 4 | Same pattern → `text-gradient-brand` |
| `AssetTransactionModal.tsx` | 2 | `bg-gradient-to-r from-[#06b6d4] to-[#7c3aed]` → `bg-gradient-brand`; hover shadows → `var(--brand-glow-from)` |
| `PerformanceLineChart.tsx` | 3 | SVG `stopColor="#06b6d4"` → `stopColor={brand.gradientFrom}` (JS runtime) |

### 3. Branding System

| File | Description |
|------|-------------|
| `frontend/src/lib/branding.ts` | `YIELDSCHOOL_BRAND` removed entirely. Only `NEUTRAL_BRAND` remains. No toggle support. |
| `frontend/public/rumi-logo-inset.svg` | Neutral brand logo (SVG) |
| `frontend/public/rumi-logo-inset.png` | Neutral brand logo (PNG fallback) |
| `frontend/src/App.tsx` | `applyBrandCSS()` + `applyBrandTitle()` initialization |
| `frontend/src/pages/SettingsPage.tsx` | Admin branding toggle (Switch) **removed** from ToolsContent |

### 4. localStorage Migration

| File | Description |
|------|-------------|
| `frontend/src/lib/localStorageMigration.ts` | **NEW** — Migration shim that automatically migrates user data from `ysl-*` keys to `oft-*` keys on app startup |

All localStorage keys were renamed:

| Old Key (`ysl-*`) | New Key (`oft-*`) |
|--------------------|-------------------|
| `ysl-exit-plans` | `oft-exit-plans` |
| `ysl-plan-basis-configs` | `oft-plan-basis-configs` |
| `ysl-logo-cache` | `oft-logo-cache` |
| `ysl-active-tab` | `oft-active-tab` |
| `ysl-strategy-templates` | `oft-strategy-templates` |
| `ysl-admin-settings` | `oft-admin-settings` |
| `ysl-market-data-cache` | `oft-market-data-cache` |
| `ysl-column-widths-*` | `oft-column-widths-*` |
| `ysl-sidebar-*` | `oft-sidebar-*` |
| `yslfolio:categoryState` | `oftfolio:categoryState` |

The migration shim reads old keys, writes them to new keys, and removes the old keys. This preserves existing user data while completing the rename.

### 5. Package Names

| File | Before | After |
|------|--------|-------|
| `frontend/package.json` | `ysl-folio-tracker-frontend` | `onchain-folio-tracker-frontend` |
| `workers/price-cache/package.json` | `ysl-price-cache` | `onchain-folio-price-cache` |

### 6. Code Comments / Log Prefixes

| File | Before | After |
|------|--------|-------|
| `ErrorBoundary.tsx` | `[YSL-ERROR]`, `[YSL]` | `[OFT-ERROR]`, `[OFT]` |
| `lib/workerCacheProvider.ts` | "YSL Price Cache" comment | "Onchain Folio Price Cache" |
| `lib/services/market/priceFeed.ts` | "YSL Price Cache Worker" comment | "Onchain Folio Price Cache Worker" |

### 7. Cloudflare Worker

| File | Before | After |
|------|--------|-------|
| `wrangler.toml` | `name = "ysl-price-cache"` | **UNCHANGED** (added warning comment) |
| `src/index.ts` doc comment | "YSL Price Cache Worker" | "Onchain Folio Price Cache Worker" |
| `src/types.ts` doc comment | "YSL Price Cache Worker" | "Onchain Folio Price Cache Worker" |
| `src/providers/coingecko.ts` User-Agent | `YSL-Price-Cache/1.0` | `OnchainFolio-Price-Cache/1.0` |
| `src/providers/cryptorates.ts` User-Agent | `YSL-Price-Cache/1.0` | `OnchainFolio-Price-Cache/1.0` |
| `README.md` title | "YSL Price Cache Worker" | "Onchain Folio Price Cache Worker" |

### 8. Deleted Files

| Deleted | Reason |
|---------|--------|
| `docs/archive/*` | Historical YSL-era documentation — no longer relevant |
| Root CSV files (`*YSL*`) | YSL-branded example/reference data files |
| `frontend/public/yieldschool-logo.jpeg` | YieldSchool logo — no longer used |
| `frontend/public/yieldschool_inc_logo.jpeg` | YieldSchool corporate logo — no longer used |
| Root `yieldschool_inc_logo.jpeg` | YieldSchool corporate logo — no longer used |

### 9. Documentation

| File | Change |
|------|--------|
| `spec.md` | Title + body: "Yieldschool" → "Onchain" |
| `docs/HANDOFF.md` | Title + Name line updated; "Yieldschool Research Hub" → "Research Hub"; directory tree corrected |
| `docs/HANDOFF_CONDENSED.md` | Title + Name line updated; directory tree corrected |
| `docs/PROMPT_portfolio_columns_nearest_exits.md` | "Yieldschool" → "Onchain" |

---

## Cloudflare Worker — Intentionally NOT Renamed

| Item | Value | Reason |
|------|-------|--------|
| `wrangler.toml` `name` | `ysl-price-cache` | Changing creates a new worker at a different URL, breaking the live production endpoint |
| R2 bucket name | `ysl-price-snapshots` | Bucket already exists in Cloudflare; renaming would break production |
| Worker URL | `ysl-price-cache.robertripleyjunior.workers.dev` | Derived from worker name; cannot change without breaking consumers |

---

## Verification Checklist

- [ ] `npx vite build` succeeds (from `frontend/`)
- [ ] App shows emerald/purple gradients, "Onchain Portfolio Tracker" title, Rumi logo
- [ ] No branding toggle exists in Settings
- [ ] Grep for `ysl` in `frontend/src/` — only appears in `localStorageMigration.ts` (the migration key map) and comments noting legacy Cloudflare Worker URLs
- [ ] Grep for `yieldschool` in `frontend/src/` — zero results
- [ ] Grep for `#06b6d4` in `frontend/src/` — only in `themes.ts` and `ResizableSidebar.tsx` (semantic/theme colors, not branding)
