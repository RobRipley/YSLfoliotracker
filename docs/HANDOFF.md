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
| 24h % change shows 0.00% | Low | Price providers don't return change data consistently |
| Backend not connected | Low | Frontend uses localStorage; backend ready but not wired |
| R2 bucket disabled | Low | Infrastructure ready for historical snapshots |
| Large bundle size warning | Low | Vite warns about chunk >500KB; would require code splitting |
| IC assets security policy | Low | Recommend adding `.ic-assets.json5` |

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

---

## Component Reference

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

*Last updated: February 2026*
