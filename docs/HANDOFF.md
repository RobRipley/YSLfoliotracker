# YSL Portfolio Tracker - Condensed Handoff

## Project Overview

**Name:** Yieldschool Portfolio Tracker (YSLfolioTracker)  
**Purpose:** Crypto portfolio tracking app for manual management with real-time prices, category-based allocation analysis, and exit strategy planning.  
**Tech Stack:** ICP (Motoko backend), React/TypeScript/Vite frontend, TailwindCSS, Cloudflare Worker price cache  
**Live URL:** https://t5qhm-myaaa-aaaas-qdwya-cai.icp0.io/  

---

## Deployment Info

| Component | Canister ID | URL/Location |
|-----------|-------------|--------------|
| Frontend (IC) | `t5qhm-myaaa-aaaas-qdwya-cai` | https://t5qhm-myaaa-aaaas-qdwya-cai.icp0.io/ |
| Backend (IC) | `ranje-7qaaa-aaaas-qdwxq-cai` | - |
| Frontend (local) | `ulvla-h7777-77774-qaacq-cai` | http://ulvla-h7777-77774-qaacq-cai.localhost:4943/ |
| Backend (local) | `uxrrr-q7777-77774-qaaaq-cai` | - |
| Price Cache | Cloudflare Worker | https://ysl-price-cache.robertripleyjunior.workers.dev/ |
| GitHub | RobRipley/YSLfoliotracker | https://github.com/RobRipley/YSLfoliotracker |

---

## Quick Commands

```bash
# Navigate
cd /Users/robertripley/coding/YSLfolioTracker

# Set npm path (required due to nvm)
export PATH="/Users/robertripley/.nvm/versions/node/v20.20.0/bin:$PATH"

# Build & deploy locally
cd frontend && npm run build && cd ..
dfx canister install frontend --mode reinstall -y

# Deploy to IC mainnet
dfx deploy frontend --network ic

# Use specific identity for deployment
dfx identity use RobRipley_YSL
dfx deploy frontend --network ic
```

---

## Repository Structure (Key Files)

```
/Users/robertripley/coding/YSLfolioTracker/
├── frontend/src/
│   ├── components/
│   │   ├── CompactHoldingsTable.tsx   # Main portfolio table (categories, holdings, cash)
│   │   ├── PortfolioDashboard.tsx     # Two-pane layout, state management
│   │   ├── AllocationDonutChart.tsx   # Category allocation chart
│   │   ├── Market.tsx                 # Market tab (Coming Soon placeholder)
│   │   └── ui/                        # shadcn/ui components (custom implementations)
│   │       └── segmented-control.tsx  # Animated segmented control component
│   ├── pages/
│   │   ├── SettingsPage.tsx           # Settings & Admin pages (Theme, Formatting, etc.)
│   │   └── ExitStrategy.tsx           # Exit ladder configuration page
│   ├── lib/
│   │   ├── dataModel.ts               # Types, categorization, store
│   │   ├── store.ts                   # State management, localStorage persistence
│   │   └── priceService.ts            # Multi-provider price fetching
│   └── hooks/
│       └── useInternetIdentity.tsx    # ICP authentication
├── backend/
│   └── main.mo                        # Motoko canister (not actively used - frontend uses localStorage)
├── workers/
│   └── ysl-price-cache/               # Cloudflare Worker source
├── spec.md                            # Detailed feature specification (~700 lines)
└── docs/HANDOFF.md                    # This file
```

---

## Architecture

### Price Data Flow
```
Cloudflare Worker (primary) → CoinGecko (fallback)
       ↓
  5-min cache (KV storage)
       ↓
  Frontend fetches /prices
       ↓
  PriceAggregator in-memory cache
       ↓
  PortfolioDashboard → CompactHoldingsTable
```

**Price Cache Worker:** `ysl-price-cache.robertripleyjunior.workers.dev`
- Caches 499 crypto prices in Cloudflare KV
- 5-minute refresh cycle
- Endpoints: `/prices` (all), `/price/:symbol` (single), `/health`

### Category Thresholds
```typescript
Blue Chip:  ≥ $10B market cap
Mid Cap:    ≥ $1B and < $10B
Low Cap:    ≥ $10M and < $1B  
Micro Cap:  < $10M
```

### Data Persistence
- **Frontend:** All user data in localStorage (per-principal keys)
- **Backend:** Motoko canister exists but not actively connected
- **Exit Plans:** Stored in `ysl-exit-plans` localStorage key
- **Holdings:** Stored in `ysl-holdings` localStorage key

---

## What's Working ✅

- **Portfolio Page:** Category-grouped holdings, donut chart, live prices
- **Exit Strategy:** Global +10% cushion toggle, per-asset ladder configuration
- **CRUD Operations:** Add, Edit, Delete assets
- **Inline Notes:** Click-to-edit on holdings and cash balance
- **Internet Identity:** Authentication on IC mainnet
- **Price Fetching:** Cloudflare Worker → CoinGecko fallback chain
- **Market Cap Categorization:** Automatic with hysteresis logic
- **Cash & Stablecoins:** Always-visible category with editable notes
- **Theme System:** Midnight Neon default, 8 theme presets, hue adjustment
- **Settings Navigation:** Two-level tabs (Settings/Admin) with segmented sub-tabs

---

## Navigation Structure

### Top Navigation (Authenticated)
- Portfolio (Wallet icon)
- Exit Strategy (Target icon)
- Market (TrendingUp icon) - Coming Soon
- Settings (Cog icon)

### Settings Page Layout
Uses two-level navigation with visual hierarchy:
1. **Top-level tabs** (flat style with underline): Settings | Admin*
2. **Sub-tabs** (animated segmented control): varies by section

| Section | Sub-tabs |
|---------|----------|
| Settings | Theme, Formatting, Data |
| Admin* | Thresholds, Providers, Tools, Strategy Library |

*Admin section only visible when `IS_ADMIN === true`

### Admin Gating
**Current implementation:** `/frontend/src/pages/SettingsPage.tsx`
```typescript
const IS_ADMIN = import.meta.env.VITE_ADMIN_MODE === 'true' || import.meta.env.DEV;
```

**Environment variable:** `/frontend/.env` contains `VITE_ADMIN_MODE=true`

**To wire to real auth later:**
1. Import auth hook: `import { useInternetIdentity } from '@/hooks/useInternetIdentity';`
2. Get principal: `const { principal } = useInternetIdentity();`
3. Check against admin list or backend: `const isAdmin = ADMIN_PRINCIPALS.includes(principal);`

---

## Cloudflare Worker KV Limit Fix (January 2026)

**Problem:** Cloudflare KV free tier is 1,000 writes/day. Worker was hitting ~50% by 1pm.

**Root Cause:** Writing 2 KV keys per 5-min refresh (576 writes/day).

**Fix Applied:**
1. **Collapsed to 1 write:** Status now embedded in `prices:top500:latest` blob
2. **Skip-if-unchanged:** djb2 hash comparison skips write if data identical
3. **Removed unaccounted write:** Registry fallback no longer caches to KV

**Result:**
| Metric | Before | After |
|--------|--------|-------|
| KV writes per refresh | 2 | 1 (or 0 if unchanged) |
| Estimated writes/day | ~577 | ≤289 |
| % of free tier | ~58% | ~29% |

**Verify fix is working:**
```bash
curl https://ysl-price-cache.robertripleyjunior.workers.dev/prices/status.json
# Should show: "kvWritesPerDay": "~289 (down from 577...)"
```

**Deploy worker changes:**
```bash
cd /Users/robertripley/coding/YSLfolioTracker/workers/price-cache
export PATH="/Users/robertripley/.nvm/versions/node/v20.20.0/bin:$PATH"
npx wrangler deploy
```

---

## Known Issues / TODO

| Issue | Priority | Notes |
|-------|----------|-------|
| **On-chain portfolio storage** | **HIGH** | Migrate from localStorage to ICP canister (see details below) |
| 24h % change shows 0.00% | Low | Price providers don't return change data consistently |
| Backend not connected | Low | Frontend uses localStorage; backend ready but not wired |
| R2 bucket disabled | Low | Infrastructure ready for historical snapshots |
| Large bundle size warning | Low | Vite warns about chunk >500KB; would require code splitting |
| IC assets security policy | Low | Recommend adding `.ic-assets.json5` |

### HIGH PRIORITY: On-Chain Portfolio Storage Migration

**Goal:** Migrate portfolio data from browser localStorage to ICP canister for cross-device access and data persistence.

**Recommended Approach: Hybrid Sync (Option B)**
- localStorage remains for instant writes (no latency)
- Background sync to canister when online
- Works offline, syncs when connected
- Better UX than canister-first writes (~2-3 sec latency)

**Current State:**
- Backend canister exists with basic `Holding` type: `{ ticker, quantity, purchasePrice, purchaseDate }`
- Frontend has richer `Holding` with 15+ fields including cached market data
- Access control and user profiles already working

**Work Required:**

1. **Backend (Motoko)** - ~1 session
   - Expand `Holding` type to match frontend model (id, symbol, tokensOwned, avgCost, notes, categoryLocked, lockedCategory, coingeckoId, cached market data fields)
   - Add `updateHolding()`, `deleteHolding()`, `bulkSaveHoldings()` functions
   - Add exit plans storage per user
   - Add strategy templates storage (admin-only)

2. **Frontend Integration** - ~1-2 sessions
   - Create canister client service with actor
   - Modify Zustand store to sync with canister in background
   - Implement conflict resolution (last-write-wins or merge)
   - Add sync status indicators in UI
   - Handle offline queue for pending writes

3. **Migration & Testing** - ~1 session
   - One-time localStorage → canister migration on first load
   - Handle edge cases (partial sync, network failures)
   - Test cross-device access
   - Verify data integrity

---

## Low Priority Enhancements

### UI/UX Improvements

| Item | Effort | Notes |
|------|--------|-------|
| **Donut chart hover animation** | Small | Smoother transitions on hover, remove tooltip box, instead highlight corresponding category row below with subtle glow/pulse |
| **Settings page layout** | Small | Two-column panel layout for wider screens (responsive). Fix active tab highlighting which is currently invisible. Formatting tab especially needs cleanup. |
| **DeFi manual positions** | Small-Medium | Until DeBank/DeFiLlama integration, allow manual DeFi entries: name, value, avg cost, notes. No price lookups. Counts toward portfolio total. |

### Data Import/Export

| Item | Effort | Notes |
|------|--------|-------|
| **Export to CSV/JSON** | Small | Trivial - serialize holdings from Zustand store, trigger download. Format: `symbol, tokens, avgCost, purchaseDate, notes, category` |
| **Import from CSV** | Medium | Column mapping, validation, duplicate handling, symbol resolution. Start with YSL Google Sheets template format. |
| **Exchange transaction import** | Large | Coinbase, Kraken, Binance each have different formats. Needs format detection, per-exchange parsers, transaction aggregation, avg cost calculation (FIFO/LIFO/average). Essentially a mini portfolio tracker engine. Consider existing parser libraries. |

### Notifications System

| Item | Effort | Notes |
|------|--------|-------|
| **In-app notifications** | Medium | Notification store, bell icon with badge, dropdown panel, read/unread state. Triggers: price alerts, exit targets hit, portfolio milestones. |
| **Email notifications** | Medium-Large | Requires email service (SendGrid/AWS SES), email verification flow, preferences UI, backend scheduled jobs. Canister needs HTTP outcalls or separate service. |

### Research Hub Integration (Market Tab)

| Item | Effort | Notes |
|------|--------|-------|
| **Yieldschool Research Hub** | Exploratory | Integrate research reports from Circle.so (yieldschool.app) into Market tab. |

**Circle.so API Limitations:** Their API is member/space management focused, not content retrieval. Options:
1. **Manual JSON file** - `research-reports.json` with asset metadata and Circle links, manually updated. Simple and reliable.
2. **Airtable/Notion as CMS** - Store report metadata, pull via API. Easy manual updates, auto-pulls to app.
3. **Full Circle integration** - Would need content API access (contact Circle) or scraping solution.

Recommendation: Start with manual/semi-auto approach, explore full integration separately.

---

## Key Technical Insights (Gotchas)

### 1. nvm Path Issue
Desktop Commander shell doesn't inherit nvm paths. Always run:
```bash
export PATH="/Users/robertripley/.nvm/versions/node/v20.20.0/bin:$PATH"
```

### 2. Holding Interface Property Names
The `Holding` interface uses:
- `tokensOwned` (NOT `tokens`)
- `avgCost` (NOT `avgCostUsd`)

### 3. shadcn/ui Components are Custom
The `dropdown-menu.tsx`, `tooltip.tsx`, `dialog.tsx`, `popover.tsx` are custom implementations with state management, not the real Radix primitives. They use React context for open/close state.

### 4. Price Service Fallback Chain
CryptoRates.ai fails from localhost (CORS), so the chain is:
1. Cloudflare Worker (primary, uses CoinGecko)
2. CryptoRates.ai (fallback, often fails)
3. CoinGecko direct (final fallback)

### 5. Exit Plans Storage Key
Exit plans are stored at `ysl-exit-plans` in localStorage, keyed by holding ID. The ExitStrategy page manages this directly.

### 6. Motoko 0.29+ Persistence
Backend uses `persistent actor` with all data marked `transient` (does NOT persist across upgrades). If data persistence is needed, implement stable storage patterns.

### 7. dfx Identity for Deployment
Use `dfx identity use RobRipley_YSL` before deploying to ensure correct controller.

---

## Example Portfolio Data Model

From the Google Sheets reference:

**Blue Chip (>$10B):** SOL, ETH, BTC, SUI, BNB, LINK  
**Mid Cap ($500M-$10B):** RENDER, ONDO, ZRO, AERO, HNT, VIRTUAL, NEAR  
**Low Cap ($10M-$500M):** KMNO, SERV, WELL, COOKIE, DEEP

**Target Allocation Presets:**
| Style | Blue Chip | Mid Cap | Low Cap | Stablecoins |
|-------|-----------|---------|---------|-------------|
| Conservative | 70% | 10% | 5% | 15% |
| Balanced | 65% | 20% | 10% | 5% |
| Aggressive | 50% | 25% | 20% | 5% |

---

## CoinGecko Logo Resolution Fix (February 2026)

**Problem:** PAYAI and UMBRA showed fallback letter icons instead of logos. Root cause: micro cap coins not in top 500 cache, and ambiguous symbols without disambiguation.

**Root Cause Analysis:**
1. Worker cache registry only includes top 500 coins
2. Holdings only stored ticker symbol, not CoinGecko ID
3. For ambiguous symbols (multiple coins with same ticker), system picked arbitrarily
4. No way for users to specify which coin they meant

**Fix Applied:**

1. **New CoinGecko Search Service** (`/frontend/src/lib/coinGeckoSearch.ts`):
   - `SYMBOL_TO_COINGECKO_ID` map with explicit mappings for problematic coins (PAYAI, UMBRA, etc.)
   - `searchCoinGecko()` - search CoinGecko API with caching
   - `getBestCoinGeckoId()` - resolve symbol to most likely ID
   - `isAmbiguousSymbol()` - detect when disambiguation is needed

2. **Holding Interface Extended** (`/frontend/src/lib/dataModel.ts`):
   - `coingeckoId?: string` - stores canonical CoinGecko ID
   - `logoUrl?: string` - stores resolved logo URL
   - `addHolding()` now accepts and stores both fields

3. **UnifiedAssetModal Enhanced** (`/frontend/src/components/UnifiedAssetModal.tsx`):
   - Debounced CoinGecko search on symbol input
   - Logo preview shown next to symbol input
   - Disambiguation picker when multiple coins match same symbol
   - Stores `coingeckoId` and `logoUrl` with new holdings

4. **Logo Fetching Uses Stored IDs** (`/frontend/src/components/PortfolioDashboard.tsx`):
   - `fetchLogos()` now checks holdings for stored `coingeckoId`
   - Uses new `aggregator.getLogosWithIds()` for direct ID-based lookup
   - Falls back to symbol lookup for holdings without stored IDs

5. **New PriceAggregator Method** (`/frontend/src/lib/priceService.ts`):
   - `getLogosWithIds(symbolToIdMap)` - fetches logos using CoinGecko IDs directly

**Key Mappings Added:**
```typescript
'PAYAI': 'payai-network',
'UMBRA': 'umbra',
'RENDER': 'render-token',
'ONDO': 'ondo-finance',
'KMNO': 'kamino',
'DEEP': 'deepbook',
// ... and many more major coins
```

**Result:** New assets added via the modal will have correct logos. Existing holdings need to be re-added or manually updated to get logos.

**Files Changed:**
- `/frontend/src/lib/coinGeckoSearch.ts` (NEW)
- `/frontend/src/lib/dataModel.ts`
- `/frontend/src/lib/store.ts`
- `/frontend/src/lib/priceService.ts`
- `/frontend/src/components/UnifiedAssetModal.tsx`
- `/frontend/src/components/PortfolioDashboard.tsx`

---

## CoinGecko Symbol Mappings

The price service includes mappings for common symbols:
```typescript
{
  'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana',
  'BNB': 'binancecoin', 'LINK': 'chainlink', 'ICP': 'internet-computer',
  'RENDER': 'render-token', 'ONDO': 'ondo-finance', 'KMNO': 'kamino',
  'DEEP': 'deepbook-protocol', 'SUI': 'sui', 'NEAR': 'near',
  // ... see priceService.ts for full list
}
```

---

## File References

| Purpose | File |
|---------|------|
| Full spec | `/spec.md` (~700 lines) |
| Price service docs | `/PRICE_SERVICE.md`, `/QUICK_REF.md` |
| Worker source | `/workers/ysl-price-cache/` |
| Example data | `/Example Portfolio.xlsx`, `/*.csv` |
| Market backup | `/frontend/src/components/Market.tsx.backup` |

---

## Low Priority / Future Work - Disabled UI Features

This section documents all UI elements that have been scaffolded but are currently disabled, awaiting future implementation.

---

### Settings > Theme Tab - Customization Section

**Location:** `/frontend/src/pages/SettingsPage.tsx` (ThemeContent component, ~lines 920-985)

| Feature | UI Type | Description | What's Needed to Enable |
|---------|---------|-------------|------------------------|
| High contrast mode | Switch toggle (disabled) | Increases color contrast for accessibility | Wire to CSS custom property or filter; add to theme settings store |
| Reduced motion | Switch toggle (disabled) | Disables animations for motion-sensitive users | Wire to CSS `prefers-reduced-motion` override; wrap animations in conditional |
| Density (Compact/Roomy) | Segmented control (disabled, "Compact" selected) | Controls spacing/padding throughout UI | Create density CSS variables; apply to Card, Table, Input padding |
| Accent intensity | Slider (disabled, 0-100, default 50) | Controls saturation/vibrancy of accent colors | Wire to HSL saturation modifier in theme system |

**Note:** The Reset button for Accent (hue) Adjustment IS functional - it resets hue to 0° when clicked.

---

### Settings > Formatting Tab

**Location:** `/frontend/src/pages/SettingsPage.tsx` (FormattingContent component, ~lines 1050-1150)

| Feature | UI Type | Description | What's Needed to Enable |
|---------|---------|-------------|------------------------|
| Display Currency | Select dropdown (disabled): USD, EUR, CAD, JPY | Changes currency symbol and formatting | Wire to settings store; add conversion rates API; update `formatCurrency()` utility |
| Thousands separators | Switch toggle (disabled, default checked) | Controls comma/period formatting in numbers | Wire to `formatCurrency()` and `formatTokens()` functions |
| Compact notation | Switch toggle (disabled) | Shows 12,345 as "12.3K", 1,234,567 as "1.2M" | Implement via `Intl.NumberFormat` with `notation: 'compact'` |
| Text Size | Segmented control (disabled): Small / Default / Large | Scales base font size | Wire to root CSS `font-size` variable or body class |

---

### Admin > Providers Tab - Advanced Settings

**Location:** `/frontend/src/pages/SettingsPage.tsx` (ProvidersContent component, ~lines 1370-1410)

| Feature | UI Type | Description | What's Needed to Enable |
|---------|---------|-------------|------------------------|
| Provider Priority | Button "Configure" (disabled) | Drag-to-reorder fallback chain priority | Build drag-and-drop list UI; wire to priceService fallback order |
| Rate Limiting | Switch toggle (disabled) | Per-provider request limits | Add rate limiter to priceService; store limits per provider |
| Custom Endpoints | Button "Add" (disabled) | Add custom price API URLs | Build endpoint entry modal; validate URLs; add to provider list |

---

### Admin > Strategy Library Tab (Entire Section Disabled)

**Location:** `/frontend/src/pages/SettingsPage.tsx` (StrategyLibraryContent component, ~lines 1598-1752)

This entire section is UI scaffolding for future implementation.

| Feature | UI Type | Description | What's Needed to Enable |
|---------|---------|-------------|------------------------|
| Strategy Templates table | Table with empty state | Lists saved strategy templates | Backend storage for templates; CRUD API; state management |
| Create Strategy button | Button (disabled) | Opens create form | Enable button; wire to form submission |
| Strategy Name | Input (disabled) | Name for the template | Wire to form state; validate uniqueness |
| Description | Input (disabled) | Brief description | Wire to form state |
| Target Category | Select dropdown (disabled): Blue Chip, Mid Cap, Low Cap, All | Which category this strategy applies to | Wire to form state; filter on Exit Strategy page |
| Ladder Rules table | Table with 4 sample rungs | Multiplier/percentage configuration | Wire to form state; add/edit/delete rung functionality |
| Ladder Rules Edit buttons | Ghost buttons (disabled) | Edit individual rungs | Build rung edit modal; validate percentages sum to ≤100% |
| Save Strategy button | Button (disabled) | Saves template to storage | Wire to backend save; add to templates list |
| Cancel button | Button (disabled) | Cancels form | Wire to reset form; return to list view |
| Import Strategies | Button (disabled) | Import templates from JSON/CSV | Build import parser; validate format; merge with existing |
| Export Strategies | Button (disabled) | Export templates to JSON/CSV | Generate export file; trigger download |

**Sample Ladder Rules in UI:**
| Multiplier | % to Sell |
|------------|-----------|
| 2x | 25% |
| 3x | 25% |
| 5x | 25% |
| 10x | 25% |

---

### Market Tab (Coming Soon Placeholder)

**Location:** `/frontend/src/components/Market.tsx` (79 lines - placeholder)  
**Original Implementation:** `/frontend/src/components/Market.tsx.backup` (498 lines - full implementation)

The Market tab is currently a "Coming Soon" placeholder. The original implementation is preserved and can be restored.

| Feature | Description | What's Needed to Enable |
|---------|-------------|------------------------|
| Top Volume Feed | 24h volume-sorted asset list with sortable columns | Restore from backup; verify API integration |
| Screener | Filter by market cap, volume, % change, search | Restore from backup; wire filters to state |
| "Add to Portfolio" button | Quick-add assets from Market tab | Restore from backup; verify callback integration |
| Watchlists | Save and track favorite assets | New feature - design persistence, build UI |
| Discovery | Trending assets, new listings, momentum signals | New feature - requires external data source |

**To restore original Market implementation:**
```bash
cp /frontend/src/components/Market.tsx.backup /frontend/src/components/Market.tsx
cd frontend && npm run build && cd ..
dfx deploy frontend --network ic
```

---

### Summary of All Disabled Features by Area

| Area | Count | Features |
|------|-------|----------|
| Theme Customization | 4 | High contrast, Reduced motion, Density, Accent intensity |
| Formatting | 4 | Currency dropdown, Thousands separators, Compact notation, Text size |
| Provider Advanced | 3 | Provider priority, Rate limiting, Custom endpoints |
| Strategy Library | 12 | Full CRUD scaffolding (templates, form, rungs, import/export) |
| Market Tab | 5 | Volume feed, Screener, Add button, Watchlists, Discovery |
| **Total** | **28** | Disabled UI elements |

---

## Recent Development History

### Navigation Restructure (January-February 2026)

**Summary:** Consolidated Admin and Test pages under unified Settings with admin gating.

**Key Changes:**
- Removed separate Admin and Test top-level tabs
- Created SettingsPage with two-level navigation (Settings/Admin sections)
- Implemented TopLevelTabs component (flat style with underline indicator)
- Created reusable SegmentedControl component (animated sliding pill)
- Added admin gating via `IS_ADMIN` flag

**Files Created:**
- `/frontend/src/pages/SettingsPage.tsx` - Unified settings/admin page
- `/frontend/src/components/ui/segmented-control.tsx` - Reusable nav component

### Theme Tab Redesign (February 2026)

**Summary:** Two-column layout with enhanced preview and disabled customization options.

**Key Changes:**
- Left column: Theme cards in 4x2 grid (reordered to separate similar themes)
- Right column: Preview + Accent Adjustment + Customization (disabled)
- Added mini header bar, button sample, category pills, table row previews
- Added Reset button for hue adjustment (functional)

### Formatting Tab Enhancement (February 2026)

**Summary:** Added disabled UI scaffolding for future formatting features.

**Key Changes:**
- Reorganized into cards: Decimal Precision (working), Currency Display, Number Formatting, Typography
- All new controls disabled with "Coming Soon" labels

### Provider Tab Enhancement (February 2026)

**Summary:** Added disabled "Advanced Settings" section.

**Key Changes:**
- Existing Enable Fallback and Cache TTL remain functional
- Added disabled Provider Priority, Rate Limiting, Custom Endpoints

### Strategy Library Scaffolding (February 2026)

**Summary:** Created comprehensive UI scaffolding for admin strategy templates.

**Key Changes:**
- Coming Soon notice with feature description
- Strategy Templates table with empty state
- Create Strategy form with all fields disabled
- Import/Export buttons disabled

### Market Tab Placeholder (February 2026)

**Summary:** Replaced full Market implementation with Coming Soon page.

**Key Changes:**
- Original 498-line implementation preserved as `Market.tsx.backup`
- New 79-line placeholder with planned features list
- Documented restoration instructions

### Portfolio Page UI Cleanup (February 2026)

**Summary:** Tightened header spacing and added session persistence for category expand/collapse.

**Key Changes:**
- Removed redundant "Portfolio" page heading
- Added prominent total value display in Allocation card
- Created `categoryExpandState.ts` for localStorage persistence
- Category expand/collapse state survives page refresh

### Exit Strategy Plan Basis Popover Improvements (February 2026)

**Summary:** Fixed plan basis popover functionality, positioning, and overflow issues.

**Issues Fixed:**
1. **Popover closing on selection:** Click-outside handler was detecting portal content as "outside" - fixed by registering portal content with parent context
2. **Popover not staying with content on scroll:** Changed from portal-based `position: fixed` to inline `position: absolute` relative to trigger container
3. **Category cards causing scrollbar when popover opened:** Changed overflow from `overflow-hidden`/`overflow-x-auto` to `overflow-visible` on category cards
4. **Translucency too high:** Increased background opacity from `bg-slate-900/98` to `bg-slate-900` (solid)

**Key Changes:**
- `/frontend/src/components/ui/popover.tsx`: 
  - Added `registerContent` to context for click-outside detection
  - Removed portal rendering, now renders inline with `position: absolute`
  - z-index lowered to `z-40` (below header's `z-50`) so popover goes behind header when scrolling
- `/frontend/src/pages/ExitStrategy.tsx`:
  - Changed Card className from `overflow-hidden` to `overflow-visible`
  - Changed holdings container from `overflow-x-auto` to `overflow-visible`

**Behavior:**
- Selecting an option auto-saves immediately (no save button)
- Popover scrolls with page content naturally
- Popover can extend beyond category card boundaries without triggering scrollbar
- When scrolling far enough, popover goes behind sticky header

---

### Exit Strategy Page Fixes (February 2026)

**Summary:** Fixed critical bugs where assets and logos weren't showing on Exit Strategy page, and tokens-to-sell calculations were incorrect.

**Root Causes Identified:**
1. ExitStrategy was importing global `store` directly from `dataModel.ts` instead of using `usePortfolioStore(principal)` hook
2. Missing `store.holdings` in `groupedHoldings` useMemo dependency array caused blank renders
3. No fallback for holdings without live market cap data (they were being skipped)
4. `tokensToSell` values weren't recalculated when holding's `tokensOwned` changed

**Key Changes:**
- Added `usePortfolioStore` and `useInternetIdentity` hooks to ExitStrategy component
- Added market cap fallback chain: `price?.marketCapUsd ?? holding.lastMarketCapUsd ?? 0`
- Holdings without any market cap data now default to `'micro-cap'` category
- Added `store.holdings` to `groupedHoldings` useMemo dependency array
- Added new useEffect to sync `tokensToSell` with current `tokensOwned` when holdings change

**Files Changed:**
- `/frontend/src/pages/ExitStrategy.tsx`

**Technical Notes:**
- The `usePortfolioStore` hook returns principal-aware data; the global store in `dataModel.ts` is a singleton that may be stale
- Exit plans are stored in localStorage (`ysl-exit-plans` key) and persist across sessions
- When a user updates token amounts for a holding, the exit plan's `tokensToSell` values must be recalculated based on the percentages

---

## Component Reference

### PlanBasisPopover (Exit Strategy)

**Location:** `/frontend/src/pages/ExitStrategy.tsx` (lines ~248-425)

**Features:**
- Auto-save on change (no save button needed)
- Three plan basis options:
  - **Average cost:** Uses holding's avgCost directly
  - **Avg + cushion (default):** avgCost × (1 + cushionPct/100), with editable percentage field (defaults to 10%)
  - **Custom:** User-defined custom price
- Live-updating header shows "PLAN BASIS FOR [SYMBOL]" with calculated value
- Persisted per-holding in localStorage (`ysl-plan-basis-configs` key)

**Storage Keys:**
- `ysl-exit-plans`: Exit plan configurations per holding
- `ysl-plan-basis-configs`: Plan basis mode and values per holding
- `ysl-logo-cache`: Token logo URLs

### SegmentedControl

**Location:** `/frontend/src/components/ui/segmented-control.tsx`

**Usage:**
```tsx
import { SegmentedControl, type SegmentedTab } from '@/components/ui/segmented-control';

const tabs: SegmentedTab[] = [
  { id: 'theme', label: 'Theme', icon: <Palette className="h-4 w-4" /> },
  { id: 'data', label: 'Data', icon: <Download className="h-4 w-4" /> },
];

<SegmentedControl
  value={activeTab}
  onChange={setActiveTab}
  tabs={tabs}
  variant="default"  // or "amber" for admin sections
  size="md"          // or "sm" for sub-tabs
/>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| value | string | Currently active tab ID |
| onChange | (value: string) => void | Callback when tab changes |
| tabs | SegmentedTab[] | Array of { id, label, icon? } |
| variant | 'default' \| 'amber' | Color scheme |
| size | 'sm' \| 'md' | Size variant |

### TopLevelTabs (Internal)

**Location:** `/frontend/src/pages/SettingsPage.tsx` (lines ~98-180)

Flat tab style with underline indicator. Used for Settings/Admin section toggle.
Could be extracted to `/components/ui/` if needed elsewhere.

---

### Folder-Style Tabs for Theme Collections (February 2026)

**Summary:** Implemented proper folder-style tabs for theme collection selector with visible borders and panel connection.

**Visual Design:**
- **Tabs:** 3 equal-width buttons with `border-2 border-white/70` (thick visible white border)
- **All tabs:** Rounded top corners on BOTH left and right (`rounded-tl-lg rounded-tr-lg`)
- **Active tab:** 3-sided border (top, left, right), no bottom border, same background as panel (`bg-slate-900/80`), extends down `-mb-[2px]` to cover panel's top border
- **Inactive tabs:** 4-sided border (includes bottom), transparent background
- **Panel:** `border-2 border-white/70 rounded-b-lg bg-slate-900/80` - same thick border, matches tab styling
- **Mask strip:** Absolutely positioned `div` that covers panel's top border under active tab (height 2px, z-20)

**Key Implementation Details:**

```tsx
// FolderTabs component structure
<div className="grid grid-cols-3 w-full">
  {collections.map((collection, index) => (
    <button
      className={cn(
        "px-4 py-3 text-sm font-medium",
        "rounded-tl-lg rounded-tr-lg",  // Both top corners rounded on ALL tabs
        "border-t-2 border-l-2 border-r-2 border-white/70",  // 3 sides always
        isActive && [
          "bg-slate-900/80 text-slate-100",
          "relative z-20 -mb-[2px]",  // Extends down to cover panel border
        ],
        !isActive && [
          "bg-transparent text-slate-400",
          "border-b-2",  // Inactive gets bottom border too
        ]
      )}
    />
  ))}
</div>

// ThemePanel with mask strip
<div className="relative">
  <div className="rounded-t-none rounded-b-lg border-2 border-white/70 bg-slate-900/80 p-4 relative z-10">
    {children}
  </div>
  {/* Mask strip covers panel border under active tab */}
  <div
    className="absolute top-0 h-[2px] bg-slate-900/80 z-20"
    style={{ left: `${activeIndex * 33.3333}%`, width: '33.3333%' }}
  />
</div>
```

**Theme Cards (inside panel):**
- Changed from `border-2` (thick) to `border border-slate-800` (soft/subtle)
- Same rounded corners and backgrounds maintained

**Files Changed:**
- `/frontend/src/pages/SettingsPage.tsx` - FolderTabs and ThemePanel components

---

### Exit Strategy Page Enhancements (February 2026)

**Summary:** Fixed plan basis popover z-index issue and added percentage displays for Unrealized P/L and Expected Profit.

**Issues Fixed:**

1. **Plan Basis Popover Z-Index:** Popovers were rendering behind sibling category Cards due to stacking context isolation. Fixed by dynamically adding `z-index: 100` to the parent Card (identified by `.glass-panel` class) when a popover opens.

2. **Missing Percentage Displays:** Added smaller percentage text below Unrealized P/L and Expected Profit columns:
   - **Unrealized P/L %:** `(positionValue - totalCost) / totalCost * 100` - shows how much the position is up/down from original investment
   - **Expected Profit %:** `expectedProfit / totalCost * 100` - shows what percent of the original investment the expected profit represents (NOT total return including principal)

**Key Implementation Details:**

```tsx
// Popover z-index fix - finds parent Card and elevates it when open
React.useEffect(() => {
  if (!actualOpen || !containerRef.current) return;
  
  let cardElement: HTMLElement | null = containerRef.current;
  while (cardElement && !cardElement.classList.contains('glass-panel')) {
    cardElement = cardElement.parentElement;
  }
  
  if (cardElement) {
    cardElement.style.zIndex = '100';
    cardElement.style.position = 'relative';
    // Cleanup restores original values
  }
}, [actualOpen]);

// Percentage display in AssetRow
<div className="w-28 text-right flex-shrink-0 flex flex-col items-end">
  <span className={`text-sm font-medium tabular-nums ${unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
    {unrealizedPnL >= 0 ? '+' : ''}{formatPrice(unrealizedPnL)}
  </span>
  <span className={`text-[10px] tabular-nums ${unrealizedPnL >= 0 ? 'text-success/70' : 'text-danger/70'}`}>
    {totalCost > 0 ? `${((unrealizedPnL / totalCost) * 100).toFixed(1)}%` : '—'}
  </span>
</div>
```

**Files Changed:**
- `/frontend/src/components/ui/popover.tsx` - Added parent Card z-index elevation on popover open
- `/frontend/src/pages/ExitStrategy.tsx` - Added percentage displays below Unrealized P/L and Expected Profit

---

*Last updated: February 2026*


---

### Strategy Library Integration & Button Hierarchy (February 2026)

**Summary:** Integrated Strategy Library templates with Exit Strategy page, fixed z-index layering issues, and implemented consistent 3-tier button visual hierarchy across the app.

**Key Changes:**

#### 1. Strategy Library Templates Now Available to All Assets

Previously, exit strategies were hardcoded by category (Blue Chip got different options than Mid/Low Cap). Now:
- All templates from the Strategy Library are available for ALL assets regardless of category
- When admin creates a new template in Settings > Admin > Strategy Library, it immediately appears in Exit Strategy dropdowns
- Templates sync in real-time via custom event (`strategyTemplatesUpdated`)

**Files Changed:**
- `/frontend/src/pages/ExitStrategy.tsx` - Imports and uses templates from `strategyTemplates.ts`
- `/frontend/src/lib/strategyTemplates.ts` - Added `dispatchEvent` on `saveTemplates()` for real-time sync

#### 2. Z-Index Layering Fixes

**Problems Fixed:**
- Plan basis modal was scrolling in front of header
- Strategy dropdowns were hiding behind category panels below

**Solutions:**
- Category cards now have decreasing z-index: Blue Chip (z-40), Mid Cap (z-30), Low Cap (z-20), Micro Cap (z-10)
- Popover and SelectContent components elevated to z-index 100
- Header remains at z-50 so it stays above category cards

**Files Changed:**
- `/frontend/src/components/ui/popover.tsx` - z-index changed from 50 to 100
- `/frontend/src/components/ui/select.tsx` - z-index changed from 50 to 100
- `/frontend/src/pages/ExitStrategy.tsx` - Category Cards get dynamic z-index by position

#### 3. Strategy Library Create Form Layout

**Changes:**
- Exit Points header, preview text, validation warning, and Add Exit button all on single line
- Warning badge appears inline after preview text
- Add Exit button right-aligned on that row

**Files Changed:**
- `/frontend/src/components/StrategyLibrary.tsx`

#### 4. Button Visual Hierarchy (3 Tiers)

Implemented consistent button styling system across the app:

| Tier | Use Case | Style | Examples |
|------|----------|-------|----------|
| **Tier 1 - PRIMARY** | Commit/high-stakes actions | `gradient-outline-btn` with glow | Sign Out, Create Strategy, Save Changes |
| **Tier 2 - SECONDARY** | Cancel/dismiss/back | Ghost outline, muted border, same height | Cancel, Back, Close |
| **Tier 3 - CONTEXTUAL** | Small, repeatable, in-context actions | Ghost outline with accent text, no glow | Add Exit, Add Row |

**Implementation:**
```tsx
// Tier 1 - PRIMARY CTA
<button className="gradient-outline-btn transition-smooth">
  <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
    Create Strategy
  </span>
</button>

// Tier 2 - SECONDARY
<button className="px-5 py-2.5 rounded-full border border-slate-600 text-slate-300 font-semibold text-sm hover:border-slate-500">
  Cancel
</button>

// Tier 3 - CONTEXTUAL
<button className="px-4 py-2 rounded-full border border-slate-600 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-400 font-medium text-sm">
  <Plus className="h-4 w-4" />
  <span>Add Exit</span>
</button>
```

**Files Changed:**
- `/frontend/src/components/StrategyLibrary.tsx` - Applied all 3 tiers

---

*Last updated: February 3, 2026*


---

## Pending Low Priority Tasks

### Exit Strategy Page UI Polish

| Issue | Description | Priority |
|-------|-------------|----------|
| **Plan basis modal z-index** | Modal appears in front of the sticky header when scrolling. Should go behind header (z-50). Currently z-100 which is higher than header. | Low |
| **Strategy dropdown opacity** | SelectContent dropdown is too transparent (`bg-background/95`) compared to plan basis modal (solid `bg-slate-900`). Looks messy/inconsistent. Should match modal opacity. | Low |

**Fix Notes:**
- Plan basis popover: Change z-index from 100 to something below header's z-50 (e.g., z-40), but still above category cards
- Strategy dropdown: In `/frontend/src/components/ui/select.tsx`, change `bg-background/95` to `bg-slate-900` or similar solid background to match popover styling

---

*Last updated: February 3, 2026*


### Strategy Builder Dual Action Bars

**Status:** Not started  
**Priority:** Low (but mandatory when implemented)

Implement DUAL action bars (top + bottom) on the Create/Edit Strategy builder page to eliminate "scroll back up to save" friction.

**SCOPE**
- Apply to the strategy builder screen where the user edits exit points (the long, scroll-heavy page with the exit matrix + summary metrics).
- Do NOT apply to the Strategy Library list page.

**TOP ACTION BAR (existing)**
- Keep the current top action bar directly under the page title/subtitle.
- Buttons:
  - Cancel = secondary/ghost
  - Create Strategy (or Save Strategy when editing) = primary (same style/component as "Sign Out")
- Keep existing validation behavior (primary disabled until valid).

**BOTTOM ACTION BAR (new)**
- Add a second action bar at the bottom of the builder page so users can save/cancel after finishing edits.
- Place it AFTER the exit table and summary metrics section, aligned with the main content width (not full viewport).
- Button order: Cancel (left) → Create/Save (right).
- Styling must match the top bar exactly (same components/variants/sizing).
- The bottom bar must call the same handlers as the top bar (no duplicated logic).

**BEHAVIOR REQUIREMENTS**
- Both action bars trigger the exact same actions:
  - Cancel → same navigation/close behavior as top Cancel
  - Create/Save → same submit/save mutation as top Create/Save
- Loading/disabled states must stay in sync:
  - If saving is in progress, BOTH primary buttons show loading/disabled
  - If validation fails, BOTH primary buttons are disabled
- Do not introduce new confirmation dialogs unless one already exists.

**LABELING**
- If the screen is "Create", label primary: "Create Strategy"
- If the screen is "Edit", label primary: "Save Strategy"
- Both top and bottom must show the same label.

**OPTIONAL (only if simple)**
- If you can do it cleanly, make the bottom action bar sticky to the bottom of the viewport while scrolling, but ONLY within the builder page content area (not overlapping the global nav). If this is non-trivial, keep it non-sticky and simply place it at the bottom of the page.

**IMPLEMENTATION NOTE**
- Prefer extracting a reusable `<StrategyActionBar />` component used twice (top + bottom) to guarantee consistent styling and synced states.
- Do not change any unrelated layout or styling while implementing this.

**Files to modify:**
- `/frontend/src/components/StrategyLibrary.tsx` - Extract action bar component, add bottom instance



---

## Big Pending Projects

These are larger feature initiatives that require significant planning and development effort. They are documented here to preserve the vision and requirements for future implementation.

---

### Mobile-Friendly Responsive Design

**Status:** Not started  
**Effort Estimate:** 1-2 weeks for proper mobile UX

**Vision:**
Make the app usable on mobile devices. The primary use case for mobile is quick portfolio checks and status updates, not full exit strategy planning.

**Mobile-Specific UX Simplifications:**

**Exit Strategy on Mobile:**
- Users just pick a preset strategy from a dropdown
- Simplified view showing key metrics only
- Icon button opens a modal with minimal rows: just number of tokens and price per exit
- No complex inline editing of rungs
- Focus on "where am I at" rather than "let me plan my full exit"

**Portfolio on Mobile:**
- Card-based layout instead of tables
- Stacked categories with expandable sections
- Key metrics visible at a glance (total value, 24h change)

**Technical Approach:**
- Tailwind responsive prefixes (`md:`, `lg:`) for layout switching
- Card components for mobile, tables for desktop
- Bottom tab navigation or hamburger menu
- Larger touch targets for all interactive elements
- Full-screen modals instead of inline popovers where needed

**Files likely affected:**
- All page components in `/frontend/src/pages/`
- `/frontend/src/components/CompactHoldingsTable.tsx` → needs mobile card variant
- `/frontend/src/components/Layout.tsx` → responsive navigation
- `/frontend/src/pages/ExitStrategy.tsx` → simplified mobile view

---

### Associate/Admin Dashboard & Client Management

**Status:** Not started  
**Effort Estimate:** 4-8 weeks (significant backend + frontend work)

**Vision:**
Enable financial advisors/associates to manage multiple client portfolios from a centralized dashboard, with collaboration features and alerts.

**Core Features:**

#### 1. Portfolio Sharing & Permissions
- Users can designate an admin/associate as a **viewer** and/or **editor** of their portfolio
- Permission levels:
  - **Viewer:** Can see portfolio, exit strategies, and analytics (read-only)
  - **Editor:** Can modify holdings, exit strategies, and settings
- "Last edited by" indicator on portfolio showing who made the most recent change and when
- Audit log of changes (optional, for compliance)

#### 2. Associate Dashboard
**Bird's Eye View Analytics:**
- Total AUM (assets under management) across all clients
- Aggregated asset holdings with weights across entire clientele
- List of portfolios sorted by:
  - Most valuable
  - Most volatile
  - Most at-risk
- Asset popularity rankings:
  - Most commonly held assets
  - Heaviest weighted assets across all clients

**Client Portfolio List:**
- Quick overview cards for each client
- Key metrics per client: total value, 24h change, risk indicators
- Search and filter by:
  - Client name
  - Assets held (e.g., "show me all clients holding ICP")
  - Risk level
  - Portfolio size

#### 3. Asset Intelligence & Flagging
- **Alerts:** Automatic notifications if a client is exposed to an asset that's dropping significantly
- **Asset flagging:** Associates can flag assets as "problematic" or "watch" for other associates to see
- **Associate favorites:** 
  - Associates can vote/mark their favorite assets
  - Live list showing associate favorites ranked by votes
  - Average allocation % for each favorite among that associate's clients

#### 4. Client Communication
- **Notifications system:** Associates can send time-sensitive alerts to clients about their positions
- Notification types:
  - Price alerts ("Your BTC position is down 15% today")
  - Action recommendations ("Consider taking profits on SOL")
  - General updates ("Market volatility expected this week")
- Delivery: In-app notifications, email, or push (mobile)

**Technical Considerations:**
- **Backend:** Requires significant Motoko canister work:
  - User-to-user permission mapping
  - Associate-client relationships
  - Aggregation queries for dashboard analytics
  - Notification queue/delivery system
- **Authentication:** Extend Internet Identity to support role-based access
- **Data model:** 
  - New `Associate` entity
  - `PortfolioPermission` linking users to associates
  - `AssetFlag` for associate flagging
  - `Notification` for client alerts
- **Privacy:** Ensure clients control their own data sharing preferences

**UI Components Needed:**
- Associate dashboard page (new)
- Client portfolio cards
- Permission management modal (in user settings)
- Asset flagging interface
- Notification composer
- Alert/notification inbox for clients

**Files to create:**
- `/frontend/src/pages/AssociateDashboard.tsx`
- `/frontend/src/components/ClientPortfolioCard.tsx`
- `/frontend/src/components/PermissionManager.tsx`
- `/backend/` - significant canister additions

---

*Last updated: February 3, 2026*


### Known Issues / Edge Cases

#### Different Browser Profile = Different Portfolio (Expected Behavior)
**Issue:** Logging in with the same passkey from a different Chrome profile shows an empty portfolio.

**Explanation:** This is actually expected. Internet Identity generates a different principal ID for each browser/profile combination (security feature to prevent cross-site tracking). Additionally, all user data is stored in localStorage which is per-browser-profile. So even the same passkey in a different profile = different user from the app's perspective.

**Future consideration:** If users want data portability, would need to:
1. Store data in backend canister (not just localStorage)
2. Associate data with a user identifier that survives cross-profile access
3. Or provide import/export functionality

---

#### Exit Strategy Page Shows Empty Categories
**Issue:** Category headers show holding counts (e.g., "Blue Chip (3)") but no asset rows render inside.

**Root cause:** Two guards filter out holdings:
1. Line 1121: `if (!holding.avgCost) return;` - holdings without avgCost are excluded from groupedHoldings
2. Line 505: `if (!holding.avgCost || !plan) return null;` - AssetRow returns null if no exit plan exists

**When this happens:**
- Holdings added without entering an average cost won't appear
- Race condition on first load: if prices haven't fetched yet, `hasFetchedOnce` is false, exit plans aren't initialized, rows return null
- Usually resolves after price fetch completes (1-2 seconds)

**Fix ideas:**
- Show a loading state per-category while plans are initializing
- Don't skip holdings without avgCost - show them with $0.00 or "—" 
- Add better feedback when holdings are filtered out

---

#### Logo Fetch Failures for Specific Coins
**Issue:** SYRUP logo not loading in fresh browser profile, while other logos (EXE, UMBRA) load after a delay.

**Context:** 
- Logo cache is in localStorage (per-profile)
- Fresh profile has no cache, must fetch from CoinGecko
- SYRUP is mapped to `maple-finance` CoinGecko ID

**Possible causes:**
1. CoinGecko rate limiting on fresh bulk requests
2. `maple-finance` mapping might be incorrect
3. Timing issue with logo fetch vs render

**To investigate:**
- Check browser console for failed logo fetch requests
- Verify SYRUP = maple-finance is correct CoinGecko mapping
- Consider if holding was added WITH coingeckoId stored vs without

