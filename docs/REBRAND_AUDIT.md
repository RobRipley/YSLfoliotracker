# Rebrand Audit: YSLfolioTracker → OnchainFolioTracker

**Date:** February 2026
**Branch:** `rebrand/onchain-folio-tracker`

---

## Summary

Renamed the project from "Yieldschool Portfolio Tracker" to "Onchain Portfolio Tracker". The YieldSchool visual identity (cyan/violet gradients, logo, brand name) is preserved as a toggleable admin option. The default is a neutral brand using Rumi Protocol colors (emerald/purple).

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

### 3. Branding System (NEW)

| File | Description |
|------|-------------|
| `frontend/src/lib/branding.ts` | **NEW** — Core branding module with `BrandConfig`, `NEUTRAL_BRAND`, `YIELDSCHOOL_BRAND`, load/save/apply functions |
| `frontend/public/rumi-logo-inset.svg` | **NEW** — Neutral brand logo (SVG, 7.2KB) |
| `frontend/public/rumi-logo-inset.png` | **NEW** — Neutral brand logo (PNG fallback, 42.8KB) |
| `frontend/src/App.tsx` | Added `applyBrandCSS()` + `applyBrandTitle()` initialization |
| `frontend/src/pages/SettingsPage.tsx` | Added admin branding toggle (Switch) in ToolsContent |

**Branding modes:**

| Mode | App Name | Gradient From | Gradient To | Logo |
|------|----------|---------------|-------------|------|
| `neutral` (default) | Onchain Portfolio Tracker | `#34d399` (emerald) | `#d176e8` (purple) | rumi-logo-inset.svg |
| `yieldschool` | Yieldschool Portfolio Tracker | `#06b6d4` (cyan) | `#7c3aed` (violet) | yieldschool-logo.jpeg |

### 4. Package Names

| File | Before | After |
|------|--------|-------|
| `frontend/package.json` | `ysl-folio-tracker-frontend` | `onchain-folio-tracker-frontend` |
| `workers/price-cache/package.json` | `ysl-price-cache` | `onchain-folio-price-cache` |

### 5. Code Comments / Log Prefixes

| File | Before | After |
|------|--------|-------|
| `ErrorBoundary.tsx` | `[YSL-ERROR]`, `[YSL]` | `[OFT-ERROR]`, `[OFT]` |
| `lib/workerCacheProvider.ts` | "YSL Price Cache" comment | "Onchain Folio Price Cache" |
| `lib/services/market/priceFeed.ts` | "YSL Price Cache Worker" comment | "Onchain Folio Price Cache Worker" |

### 6. Cloudflare Worker

| File | Before | After |
|------|--------|-------|
| `wrangler.toml` | `name = "ysl-price-cache"` | **UNCHANGED** (added warning comment) |
| `src/index.ts` doc comment | "YSL Price Cache Worker" | "Onchain Folio Price Cache Worker" |
| `src/types.ts` doc comment | "YSL Price Cache Worker" | "Onchain Folio Price Cache Worker" |
| `src/providers/coingecko.ts` User-Agent | `YSL-Price-Cache/1.0` | `OnchainFolio-Price-Cache/1.0` |
| `src/providers/cryptorates.ts` User-Agent | `YSL-Price-Cache/1.0` | `OnchainFolio-Price-Cache/1.0` |
| `README.md` title | "YSL Price Cache Worker" | "Onchain Folio Price Cache Worker" |

### 7. Documentation

| File | Change |
|------|--------|
| `spec.md` | Title + body: "Yieldschool" → "Onchain" |
| `docs/HANDOFF.md` | Title + Name line updated; "Yieldschool Research Hub" → "Research Hub"; directory tree corrected |
| `docs/HANDOFF_CONDENSED.md` | Title + Name line updated; directory tree corrected |
| `docs/PROMPT_portfolio_columns_nearest_exits.md` | "Yieldschool" → "Onchain" |

---

## What Was Intentionally NOT Changed

### localStorage Keys (User Data — MUST NOT rename)

| Key | Purpose |
|-----|---------|
| `ysl-exit-plans` | Exit plan configurations per holding |
| `ysl-plan-basis-configs` | Plan basis mode and values per holding |
| `ysl-logo-cache` | Token logo URL cache |
| `ysl-active-tab` | Active tab persistence |
| `ysl-strategy-templates` | Custom exit strategy templates |
| `ysl-admin-settings` | Admin panel settings |
| `ysl-market-data-cache` | Market data cache |
| `ysl-column-widths-*` | Table column width preferences |
| `ysl-sidebar-*` | Sidebar state preferences |
| `yslfolio:categoryState` | Category expand/collapse state |

**Reason:** Renaming these would wipe user data for all existing users.

### Cloudflare Worker Deployment Name

| Item | Value | Reason |
|------|-------|--------|
| `wrangler.toml` `name` | `ysl-price-cache` | Changing creates a new worker at a different URL, breaking production |
| R2 bucket name | `ysl-price-snapshots` | Same — bucket already exists in Cloudflare |
| Worker URL | `ysl-price-cache.robertripleyjunior.workers.dev` | Derived from worker name |

### Operational References in Docs

| Reference | Reason |
|-----------|--------|
| `dfx identity use RobRipley_YSL` | Real dfx identity name |
| `/Users/robertripley/coding/YSLfolioTracker` | Real filesystem path |
| `RobRipley/YSLfoliotracker` (GitHub) | Real repo name (rename separately on GitHub) |
| Worker URLs in curl examples | Real deployed URLs |

### Theme System Colors

| File | Reason |
|------|--------|
| `frontend/src/lib/themes.ts` | `#06b6d4` / `#7c3aed` in theme definitions are part of the theme system, not branding |

### Semantic Category Colors

| File | Reason |
|------|--------|
| `frontend/src/components/ResizableSidebar.tsx` | `#06b6d4` used for "blue-chip" category color — semantic, not brand |

### YieldSchool Assets

| File | Reason |
|------|--------|
| `frontend/public/yieldschool-logo.jpeg` | Used by `YIELDSCHOOL_BRAND` when branding mode is active |
| `frontend/public/yieldschool_inc_logo.jpeg` | Preserved for potential future use |
| Root: `yieldschool_inc_logo.jpeg` | Preserved |

### Archive Documentation

| Path | Reason |
|------|--------|
| `docs/archive/*` | Historical records — 12 files left as-is |

### CSV Example Files

| File | Reason |
|------|--------|
| Root CSV files (`*YSL*`) | Example/reference data files |

---

## Verification Checklist

- [ ] `npx vite build` succeeds (from `frontend/`)
- [ ] Default brand shows emerald/purple gradients, "Onchain Portfolio Tracker" title, Rumi logo
- [ ] Admin toggle → YieldSchool brand activates (cyan/violet, "Yieldschool" nav text, YS logo)
- [ ] Toggle back → neutral brand restores
- [ ] Page refresh → branding mode persists
- [ ] Grep for `#06b6d4` in frontend/src — only in `themes.ts` and `ResizableSidebar.tsx`
- [ ] Grep for "Yieldschool" in frontend/src — only in `branding.ts` (YIELDSCHOOL_BRAND constant)
