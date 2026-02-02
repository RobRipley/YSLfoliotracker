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
│   │   └── ui/                        # shadcn/ui components (custom implementations)
│   ├── pages/
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
└── docs/HANDOFF_CONDENSED.md          # This file
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
- **Theme System:** Midnight Neon default, CSS custom properties

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
| Admin Panel blank | Low | Component exists but crashes on load |
| Backend not connected | Low | Frontend uses localStorage; backend ready but not wired |
| R2 bucket disabled | Low | Infrastructure ready for historical snapshots |

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

---

*Last updated: January 2026*


---

## Navigation Restructure Research (January 2026)

### Current Navigation Structure

**Top-level tabs in Layout.tsx (lines 224-276):**
- Portfolio (Wallet icon)
- Exit Strategy (Target icon)
- Market (TrendingUp icon)
- Admin (Settings icon) 
- Test (FlaskConical icon)

**Tab type definition (App.tsx):**
```typescript
type Tab = 'landing' | 'portfolio' | 'exit-strategy' | 'market' | 'admin' | 'test';
```

### Current Admin Panel Structure (AdminPanel.tsx)

The AdminPanel has 5 internal tabs:
1. **Theme** - Theme selector, hue adjustment, live preview
2. **Formatting** - Price/token decimal precision, currency display
3. **Thresholds** - Category market cap boundaries (Blue Chip, Mid Cap, Low Cap)
4. **Providers** - Price provider settings (fallback enabled, cache TTL)
5. **Data** - Import/Export (JSON, CSV holdings, transactions, ladder plans)

### Current Test Page (DataModelTest.tsx)

Contains developer/debugging tools:
- Test suite for data model helper functions
- Sample data generator
- Live view of store state (holdings, transactions, settings, categories)

### Components Requiring Modification

1. **Layout.tsx** - Remove Admin/Test tabs, add Settings tab
2. **App.tsx** - Update Tab type, remove 'test' route, add 'settings' route
3. **AdminPanel.tsx** - Restructure as SettingsPage with two-level navigation
4. **DataModelTest.tsx** - Will be moved under Admin sub-tab as "Tools"

### New Structure Plan

**Top Nav:** Portfolio, Exit Strategy, Market, Settings

**Settings Page (two-level):**
- **Settings (user accessible):**
  - Theme
  - Formatting  
  - Data (import/export)
- **Admin (admin-only, gated):**
  - Thresholds
  - Providers
  - Tools (old DataModelTest content)
  - Strategy Library (UI placeholder)

### Admin Gating Implementation

Will use a temporary `isAdmin` boolean that can be easily wired to real auth later:
- Check principal against admin list OR use environment variable
- For now: hardcode admin principal or use `VITE_ADMIN_MODE=true` env var
- Admin sub-tab only renders if `isAdmin === true`



---

## Navigation Restructure - COMPLETED (January 31, 2026)

### Summary of Changes

The navigation has been restructured to consolidate Admin and Test functionality under a unified Settings page with admin gating.

### Files Modified

1. **App.tsx**
   - Updated Tab type: `'landing' | 'portfolio' | 'exit-strategy' | 'market' | 'settings'`
   - Added `SettingsPage` import
   - Routes now include `settings` instead of `admin`/`test`

2. **Layout.tsx**
   - Removed Admin and Test navigation buttons
   - Added single Settings button with `Cog` icon
   - Updated Tab type to match App.tsx
   - Removed `FlaskConical` icon import, added `Cog`

3. **SettingsPage.tsx** (NEW - `/frontend/src/pages/SettingsPage.tsx`)
   - Created comprehensive settings page with two-level navigation
   - **User Settings tabs:** Theme, Formatting, Data (import/export)
   - **Admin tabs:** Thresholds, Providers, Tools (DataModelTest content), Strategy Library
   - Implemented admin gating via `IS_ADMIN` constant

### Admin Gating Implementation

Located at top of `SettingsPage.tsx`:

```typescript
// Options for wiring to real auth:
// 1. Check principal against admin list: principal === 'your-admin-principal-here'
// 2. Environment variable: import.meta.env.VITE_ADMIN_MODE === 'true'
// 3. Backend role check: await actor.is_admin()

const IS_ADMIN = import.meta.env.VITE_ADMIN_MODE === 'true' || 
                 import.meta.env.DEV || 
                 true; // Hardcode to true for now
```

**To enable real auth later:**
1. Import the auth hook: `import { useInternetIdentity } from '@/hooks/useInternetIdentity';`
2. Get the principal: `const { principal } = useInternetIdentity();`
3. Check against admin list or call backend: `const isAdmin = ADMIN_PRINCIPALS.includes(principal);`

### New Navigation Structure

**Top Nav (when authenticated):**
- Portfolio (Wallet icon)
- Exit Strategy (Target icon)
- Market (TrendingUp icon)
- Settings (Cog icon)

**Settings Page Sub-tabs:**

| Section | Tab | Content |
|---------|-----|---------|
| Settings | Theme | Theme selector, hue adjustment, live preview |
| Settings | Formatting | Price/token precision, currency settings |
| Settings | Data | Import/export JSON, CSV, ladder plans |
| Admin* | Thresholds | Market cap category boundaries |
| Admin* | Providers | Price provider fallback, cache TTL |
| Admin* | Tools | Developer debugging tools (was DataModelTest) |
| Admin* | Strategy Library | Placeholder for future exit strategy templates |

*Admin tabs only visible when `isAdmin === true`

### Visual Changes

- Admin sub-tabs styled with amber accent color for clear differentiation
- User tabs styled with default theme accent colors
- Divider between user and admin sections
- Shield icon badges indicate admin-only content



---

## Portfolio Page UI Cleanup (February 1, 2026)

### Summary of Changes

Cleaned up the Portfolio page hierarchy and implemented session persistence for category expand/collapse state.

### Files Modified

1. **PortfolioDashboard.tsx**
   - Removed header section ("Portfolio" title and "A calm view of your holdings..." subtitle)
   - Updated Allocation overview card to show Total Value prominently at top
   - Integrated category expand/collapse persistence using new helper module

2. **categoryExpandState.ts** (NEW - `/frontend/src/lib/categoryExpandState.ts`)
   - Helper module for persisting category expand/collapse state
   - Uses localStorage keyed by principal: `yslfolio:categoryState:<principal>`
   - Functions: `loadCategoryExpandState`, `saveCategoryExpandState`, `getDefaultExpandedCategories`

### Changes in Detail

**1. Portfolio Page Header Removed**
- The page no longer shows "Portfolio" heading or marketing subtitle
- Navigation tab already indicates location, reducing visual clutter
- Page now starts directly with the two-column layout (Positions card + Allocation card)

**2. Allocation Overview Card - Total Value Display**
- Card header now shows total portfolio value prominently: large "$XX,XXX.XX" format
- "Total value" label below the number
- Small "Allocation" label with PieChart icon in top-right corner
- Donut chart and legend remain unchanged below

**3. Category Expand/Collapse Persistence**
- **Default behavior**: All categories expanded on first load
- **Persistence**: Uses localStorage keyed by principal
- **Storage key format**: `yslfolio:categoryState:<principal>`
- **Stored data**: Array of expanded category names + timestamp
- **Session persistence**: When user returns and logs in, their collapse state is restored
- **Per-identity isolation**: Each Internet Identity gets its own saved state

### Technical Implementation

```typescript
// Storage key example
yslfolio:categoryState:abc123-xyz789-...

// Stored JSON structure
{
  "expandedCategories": ["stablecoin", "blue-chip", "mid-cap"],
  "updatedAt": 1738425600000
}
```

### Deployment

- Deployed to IC mainnet: https://t5qhm-myaaa-aaaas-qdwya-cai.icp0.io/
- Build completed successfully with no errors



---

## Positions Header Row Polish (February 2026)

### Summary
Tightened the Positions card header row spacing, increased POSITIONS label prominence, and centered all header contents.

### Changes Made (CompactHoldingsTable.tsx)

1. **Removed Card's default padding**
   - Added `!p-0` to Card className to override the built-in `p-4` padding
   - This eliminates the extra space at the top of the card

2. **Increased POSITIONS label prominence**
   - Font size: `text-sm` → `text-lg` (14px → 18px)
   - Font weight: `font-bold` (maintained)
   - Color: `text-foreground` (full brightness, no opacity)
   - Letter spacing: `tracking-[0.12em]` (tighter for larger size)

3. **Header row padding**
   - Set to `py-2` for symmetric vertical padding
   - Combined with removing Card padding, creates a tight, clean header

4. **Content area padding**
   - Increased from `px-3 py-2` to `px-4 py-3` to restore appropriate content spacing

5. **Vertical centering maintained**
   - `items-center` on parent flex container ensures all elements vertically align

6. **Additional prominence tweak (follow-up)**
   - Font size: `text-lg` → `text-xl` (18px → 20px)
   - Letter spacing: `tracking-[0.12em]` → `tracking-[0.10em]` (slightly tighter at larger size)
   - No changes to pill, info icon, or Add Asset button sizing

---

## Navbar Brand Lockup Polish (February 2026)

### Summary
Slightly increased navbar brand lockup contrast/weight; no size changes.

### Changes Made (Layout.tsx)

1. **"Yieldschool" text weight bump**
   - Font weight: `font-semibold` → `font-bold` (one step increase)

2. **"Portfolio Tracker" contrast increase**
   - Color: `text-muted-foreground` → `text-foreground/60` (slightly brighter)

3. **Improved text alignment**
   - Changed inner container from `items-center` → `items-baseline` for cleaner typography alignment

4. **Tightened lockup spacing**
   - Logo-to-text gap: `space-x-3` → `space-x-2.5`
   - Text elements gap: `gap-2` → `gap-1.5`

5. **No size changes**
   - Logo remains `w-9 h-9`
   - "Yieldschool" remains `text-base`
   - "Portfolio Tracker" remains `text-sm`

---

## Allocation Card Total Value Polish (February 2026)

### Summary
Tightened Allocation card header spacing, increased total value prominence, and added subtle professional glow.

### Changes Made (PortfolioDashboard.tsx)

1. **Reduced header vertical padding**
   - Changed from `pt-4 pb-2` to `pt-3 pb-1.5` (tighter, matches Positions card feel)
   - Added `!p-0` to Card to override default padding

2. **Increased total value font size**
   - Font size: `text-3xl` → `text-4xl` (30px → 36px, one step up)
   - Font weight remains `font-bold`

3. **Added subtle purple glow to dollar amount**
   - Applied restrained text-shadow: `0 0 8px rgba(139, 92, 246, 0.6), 0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(99, 102, 241, 0.25)`
   - Added subtle highlight panel behind number with purple/blue gradient background
   - Panel has `inset` highlight and soft outer glow for "lit" effect
   - Color matches existing violet/purple accent family
   - Effect is professional, not neon - draws eye without being "shouty"

4. **Unchanged elements**
   - "Total value" label remains `text-xs text-muted-foreground`
   - "ALLOCATION" label unchanged
   - Donut chart and legend unchanged


---

## Settings/Admin Navigation Fix (February 2026)

### Summary
Fixed the non-clickable Admin pill and correctly implemented two-level Settings navigation with proper sub-tab filtering.

### Problem
The "Admin" pill was rendered as a non-interactive `<div>` element, and the sub-tab row showed BOTH user tabs and admin tabs in one continuous 7-tab row regardless of section. Clicking "Admin" did nothing.

### Solution
1. **Added `activeSection` state** to track which top-level section is selected (`'settings'` | `'admin'`)
2. **Made top pills clickable `<button>` elements** with proper `aria-pressed` attributes
3. **Sub-tabs now filter based on `activeSection`**:
   - Settings section → Theme, Formatting, Data
   - Admin section → Thresholds, Providers, Tools, Strategy Library
4. **Section switching resets sub-tab** to first tab of that section
5. **Safety guard**: if `isAdmin` becomes false while on admin section, automatically reset to settings

### Admin Gating
**Current implementation (temporary for dev testing):**
```typescript
const IS_ADMIN = import.meta.env.VITE_ADMIN_MODE === 'true' || import.meta.env.DEV;
```

**Environment variable added to `/frontend/.env`:**
```
VITE_ADMIN_MODE=true
```

**To wire to real auth later:**
1. Import auth hook: `import { useInternetIdentity } from '@/hooks/useInternetIdentity';`
2. Get principal: `const { principal } = useInternetIdentity();`
3. Check against admin list or backend: `const isAdmin = ADMIN_PRINCIPALS.includes(principal);`

### Files Changed
- `/frontend/src/pages/SettingsPage.tsx` - Added activeSection state, clickable pills, filtered sub-tabs
- `/frontend/.env` - Added `VITE_ADMIN_MODE=true`

### Verification
- Clicking "Admin" pill switches to admin tab set (Thresholds/Providers/Tools/Strategy Library)
- Clicking "Settings" pill switches to user tab set (Theme/Formatting/Data)
- No combined 7-tab row
- No `|| true` always-admin logic remains



---

## Segmented Control Research (February 2026)

### Current Tab Styling Analysis

**Location:** `/frontend/src/components/ui/tabs.tsx`

The existing Tabs component is a custom implementation (not Radix):

**Current TabsList Styling:**
```tsx
"inline-flex items-center rounded-full bg-slate-900/80 p-1 border border-slate-800 "
```

**Current TabsTrigger Styling:**
```tsx
"px-3 py-1 text-xs rounded-full transition-colors " +
(active
  ? "bg-indigo-500 text-white"
  : "text-slate-300 hover:bg-slate-800")
```

**Issues with Current Implementation:**
1. Uses hardcoded colors (`bg-indigo-500`, `bg-slate-900/80`) instead of theme tokens
2. Text is very small (`text-xs`) - user requested "slightly larger label text"
3. No animated transition for active state changes
4. No icon support built into the component
5. Active state is just a background fill - user wants "confident filled state (one highlight)"
6. No reduced letter-spacing as requested

### Settings Page Navigation Structure

**Location:** `/frontend/src/pages/SettingsPage.tsx` (lines ~150-210)

The SettingsPage currently has **two levels of navigation**:

**Level 1 - Section Pills:** Settings | Admin (admin-only)
- Styled as clickable `<button>` elements
- Settings active: `bg-secondary/20 text-foreground shadow-xs`
- Admin active: `bg-amber-500/20 text-amber-500 shadow-xs`

**Level 2 - Sub-Tabs:** Theme/Formatting/Data OR Thresholds/Providers/Tools/Strategy Library
- Styled with inline classes
- No container bar - just flex-wrapped buttons
- Active state uses similar pattern to section pills

### Design Requirements from Task

1. **Container:** One rounded container bar with tabs inside
2. **Inactive tabs:** Flatter appearance (less border/shine)
3. **Active tab:** Confident filled state with single highlight
4. **Typography:** Slightly larger label text, reduced letter-spacing
5. **Animation:** Subtle animated transition when switching (slide or fade)
6. **Icons:** Keep icons with labels, feel like tabs not buttons
7. **Reusability:** One component with different tab sets via props

### Implementation Plan

1. Create new `SegmentedControl` component in `/frontend/src/components/ui/segmented-control.tsx`
2. Use CSS custom properties from existing theme system for consistency
3. Implement sliding pill animation using CSS transforms
4. Support icon + label combination
5. Apply to both Settings section navigation and Admin sub-tabs
6. Use `framer-motion` or pure CSS for smooth transitions

### Theme Tokens Available (from index.css)

```css
--primary: 189 94% 43%;        /* Cyan accent */
--secondary: 215 20% 20%;      /* Dark background */
--muted: 215 20% 22%;          /* Slightly lighter */
--muted-foreground: 210 15% 65%; /* Dimmed text */
--foreground: 210 20% 88%;     /* Primary text */
--border: 215 20% 25%;         /* Border color */
```

### Files to Modify

1. **Create:** `/frontend/src/components/ui/segmented-control.tsx` - New reusable component
2. **Modify:** `/frontend/src/pages/SettingsPage.tsx` - Replace inline tab styling with SegmentedControl
3. **Optional:** `/frontend/src/index.css` - Add any necessary animation keyframes



---

## Segmented Control Implementation - COMPLETED (February 2026)

### Summary
Implemented a reusable SegmentedControl component with animated sliding pill for the Settings page navigation.

### New Component
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
- `value: string` - Currently active tab ID
- `onChange: (value: string) => void` - Callback when tab changes
- `tabs: SegmentedTab[]` - Array of tab definitions with id, label, and optional icon
- `variant?: 'default' | 'amber'` - Color variant (amber for admin sections)
- `size?: 'sm' | 'md'` - Size variant for different hierarchy levels
- `className?: string` - Additional CSS classes

### Features
1. **Animated sliding pill** - Smooth 200ms transition when switching tabs
2. **Two color variants** - Default (cyan/primary) and amber (for admin)
3. **Two size variants** - md for top-level, sm for sub-tabs
4. **Icon + label support** - Icons change color based on active state
5. **Proper width** - Uses `w-fit` to size to content, not stretch
6. **Theme-aware** - Uses CSS variables for colors and shadows

### Styling Details
- Container: `bg-secondary/40 border-border/50 backdrop-blur-sm rounded-full p-1`
- Active pill: `bg-primary/15` with subtle glow shadow
- Amber variant: `bg-amber-500/20` with amber glow
- Text: `text-[14px] tracking-[-0.01em]` (md), `text-[13px]` (sm)

### Files Modified
- `/frontend/src/components/ui/segmented-control.tsx` - NEW component
- `/frontend/src/pages/SettingsPage.tsx` - Updated to use SegmentedControl

### Applied To
- Settings > Settings/Admin section toggle
- Settings > Sub-tabs (Theme/Formatting/Data)
- Admin > Sub-tabs (Thresholds/Providers/Tools/Strategy Library)



---

## Theme Tab Redesign Research (February 2026)

### Current Theme Tab Implementation

**Location:** `/frontend/src/pages/SettingsPage.tsx` (ThemeContent component, lines ~580-675)

**Current Layout:**
1. **Card header** with title "Theme Selector" and description
2. **Theme dropdown** - Select component for choosing theme
3. **Theme description** - Text below dropdown showing current theme's description
4. **Separator**
5. **Theme Preview Cards** - 2x4 grid of clickable theme preview cards
6. **Separator**
7. **Hue Adjustment** - Slider (-180 to +180) with numeric readout and color preview bars
8. **Separator**
9. **Live Preview** - Shows heading, paragraph, muted text, and buttons

### Current Theme Card Order (in PREDEFINED_THEMES object)
1. midnight-neon - Midnight Neon
2. graphite-lumina - Graphite Lumina
3. slate-minimal - Slate Minimal
4. aurora-mist - Aurora Mist
5. velvet-dusk - Velvet Dusk
6. carbon-shadow - Carbon Shadow
7. ocean-flux - Ocean Flux
8. ember-glow - Ember Glow

**Note:** Slate Minimal and Ocean Flux are in positions 3 and 7, not directly adjacent.

### Available Themes (from themes.ts)
| Key | Name | Description | Base Hue |
|-----|------|-------------|----------|
| midnight-neon | Midnight Neon | Deep blue-black base with electric cyan/magenta accents | 195 |
| graphite-lumina | Graphite Lumina | Charcoal gray base with silver/white luminous accents | 0 |
| slate-minimal | Slate Minimal | Cool gray base with subtle blue/teal accents | 200 |
| aurora-mist | Aurora Mist | Dark purple base with green/pink aurora-like accents | 280 |
| velvet-dusk | Velvet Dusk | Rich burgundy base with gold/amber accents | 340 |
| carbon-shadow | Carbon Shadow | Pure black base with red/orange ember accents | 10 |
| ocean-flux | Ocean Flux | Deep navy base with aqua/turquoise accents | 190 |
| ember-glow | Ember Glow | Dark brown base with orange/yellow fire accents | 30 |

### Current Preview Implementation
- **Theme cards**: Show 2 color bars (primary/secondary accents) + 1 background bar + theme name
- **Hue adjustment preview**: Shows 2 color bars at the bottom
- **Live preview section**: Shows heading, paragraph, muted text, and 3 buttons (gradient-outline, secondary, outline)

### Issues to Address
1. **Dropdown redundancy**: Theme can be selected both via dropdown AND clicking theme cards
2. **Descriptive text redundancy**: The description below dropdown repeats what the cards show visually
3. **Layout is single-column**: Doesn't use available horizontal space well
4. **Hue adjustment UI**: Currently uses a Slider component with basic numeric readout; could use a real slider control with Reset button
5. **Live preview is basic**: Shows text and buttons but not actual UI elements like header bars, category pills, or table rows

### Redesign Plan

**New Two-Column Layout:**
- Left column: Theme cards in 4x2 grid
- Right column: Preview section + Accent adjustment section + Customization section

**Card Grid Reorder (to separate Slate Minimal and Ocean Flux):**
1. Midnight Neon (row 1)
2. Carbon Shadow (row 1) - moved from position 6
3. Slate Minimal (row 2)
4. Aurora Mist (row 2)
5. Graphite Lumina (row 3)
6. Velvet Dusk (row 3)
7. Ocean Flux (row 4)
8. Ember Glow (row 4)

**New Preview Section:**
- Mini header bar strip
- Button sample
- Category pill sample
- Table row/card sample
- All reflecting current theme tokens

**Accent Adjustment Section:**
- Real slider with numeric readout
- "Reset" button (can be disabled)

**Customization Section (all disabled with "Coming Soon"):**
- High contrast mode toggle
- Reduced motion toggle
- Density: Compact vs Roomy segmented toggle
- Accent intensity slider



### Theme Tab Redesign - COMPLETED (February 2026)

**Summary:** Redesigned the Theme tab in Settings with a two-column layout and enhanced preview.

**Changes Made:**

1. **Two-Column Layout**
   - Left column: Theme cards in 4x2 grid
   - Right column: Preview + Accent Adjustment + Customization sections

2. **New Theme Card Order** (to separate visually similar themes):
   1. Midnight Neon
   2. Carbon Shadow
   3. Slate Minimal
   4. Aurora Mist
   5. Graphite Lumina
   6. Velvet Dusk
   7. Ocean Flux
   8. Ember Glow

3. **Enhanced Preview Section** showing:
   - Mini header bar strip with logo and nav placeholders
   - Button sample ("Add Asset")
   - Category pills (Blue Chip, Mid Cap)
   - Table row with symbol, price, and percentage

4. **Accent Adjustment Section**
   - Slider with numeric readout (-180° to +180°)
   - Color preview swatches
   - Reset button (functional)

5. **Customization Section** (disabled with "Coming Soon" labels):
   - High contrast mode toggle
   - Reduced motion toggle
   - Density: Compact vs Roomy segmented toggle
   - Accent intensity slider

**Files Modified:**
- `/frontend/src/pages/SettingsPage.tsx` - Added THEME_GRID_ORDER constant and rewrote ThemeContent component

**Bug Fixes Also Included:**
- Fixed name edit modal Cancel button to work during save operation
- Fixed click-outside to close modal in edit mode
- Fixed BigInt serialization error when saving profile to localStorage
- Added 5-second timeout for backend profile save with localStorage fallback
- Fixed modal to pre-populate with existing name values when editing

**Files Modified for Bug Fixes:**
- `/frontend/src/components/NamePromptModal.tsx` - Added useEffect to sync state with props, enabled Cancel during loading
- `/frontend/src/components/Layout.tsx` - Added serializeProfile/deserializeProfile helpers, added timeout for backend calls

---

## Low Priority / Future Work

| Feature | Location | Notes |
|---------|----------|-------|
| High contrast mode | `/frontend/src/pages/SettingsPage.tsx` (ThemeContent) | Disabled toggle in Customization section |
| Reduced motion | `/frontend/src/pages/SettingsPage.tsx` (ThemeContent) | Disabled toggle in Customization section |
| Density (Compact/Roomy) | `/frontend/src/pages/SettingsPage.tsx` (ThemeContent) | Disabled segmented control in Customization section |
| Accent intensity | `/frontend/src/pages/SettingsPage.tsx` (ThemeContent) | Disabled slider in Customization section |
| Currency display (USD/EUR/CAD/JPY) | `/frontend/src/pages/SettingsPage.tsx` (FormattingContent) | Disabled dropdown in Currency Display card. Wire to settings store, add conversion rates |
| Thousands separators toggle | `/frontend/src/pages/SettingsPage.tsx` (FormattingContent) | Disabled switch in Number Formatting card. Wire to formatCurrency/formatTokens functions |
| Compact notation toggle | `/frontend/src/pages/SettingsPage.tsx` (FormattingContent) | Disabled switch in Number Formatting card. Implement Intl.NumberFormat compact notation |
| Text Size (Small/Default/Large) | `/frontend/src/pages/SettingsPage.tsx` (FormattingContent) | Disabled segmented control in Typography card. Wire to CSS variable or root font-size scaling |
| Provider Priority | `/frontend/src/pages/SettingsPage.tsx` (ProvidersContent) | Disabled in Advanced Settings card. Drag to reorder fallback chain |
| Rate Limiting | `/frontend/src/pages/SettingsPage.tsx` (ProvidersContent) | Disabled in Advanced Settings card. Per-provider request limits |
| Custom Endpoints | `/frontend/src/pages/SettingsPage.tsx` (ProvidersContent) | Disabled in Advanced Settings card. Add custom price API endpoints |
| Strategy Library | `/frontend/src/pages/SettingsPage.tsx` (StrategyLibraryContent) | Full UI scaffolding present but disabled. Requires backend storage, template CRUD, and user-selectable presets in Exit Strategy |



---

## Formatting Tab Research (February 2026)

### Current Formatting Tab Implementation

**Location:** `/frontend/src/pages/SettingsPage.tsx` (FormattingContent component, lines ~918-1072)

**Functional Controls:**
1. **Price Decimal Precision** - Select dropdown (0-8 decimal places) - WORKING
2. **Token Decimal Precision** - Select dropdown (0-8 decimal places) - WORKING
3. **Live Preview** - Shows formatted examples using current settings - WORKING

**Previously Placeholder (non-functional):**
- Default Currency dropdown - Was disabled with "Additional currencies will be available in future updates" note

### Controls Added as Disabled UI

| Control | Type | Card | Notes |
|---------|------|------|-------|
| Currency Display | Select dropdown (USD, EUR, CAD, JPY) | Currency Display | Disabled with "Coming Soon" |
| Thousands separators | Switch toggle (default: checked) | Number Formatting | Disabled with "Coming Soon" |
| Compact notation | Switch toggle (example: 12,345 → 12.3K) | Number Formatting | Disabled with "Coming Soon" |
| Text Size | Segmented control (Small / Default / Large) | Typography | Disabled with "Coming Soon" |

### Visual Treatment for Disabled Controls
- `opacity-50` on the control wrapper
- `pointer-events-none` on interactive elements where needed
- "Coming Soon" subtitle text in `text-[10px] text-muted-foreground`
- "Future" Badge on card headers using `<Badge variant="outline">` 
- Switch and Select components use native `disabled` prop



---

## Formatting Tab Disabled UI Controls - COMPLETED (February 2026)

### Summary
Added disabled UI controls to the Formatting tab for planned future functionality, following the same visual pattern established in the Theme tab's Customization section.

### Changes Made

1. **Reorganized FormattingContent into separate cards:**
   - **Decimal Precision** (functional) - existing price/token precision controls
   - **Currency Display** (future) - new disabled currency dropdown
   - **Number Formatting** (future) - new disabled toggles
   - **Typography** (future) - new disabled text size control

2. **New Disabled Controls Added:**
   - **Currency Display dropdown:** USD, EUR, CAD, JPY options (disabled)
   - **Thousands separators toggle:** Switch defaulting to checked (disabled)
   - **Compact notation toggle:** Switch with "12,345 → 12.3K" example (disabled)
   - **Text Size segmented control:** Small / Default / Large (disabled, Default selected)

3. **Visual Treatment:**
   - `opacity-50` wrapper for reduced visual emphasis
   - `pointer-events-none` to prevent interaction
   - "Future" Badge on card headers
   - "Coming Soon" subtitle on each control
   - Consistent with Theme tab's Customization section styling

### Files Modified
- `/frontend/src/pages/SettingsPage.tsx` - Rewrote FormattingContent component

### Deployment
- Deployed to IC mainnet: https://t5qhm-myaaa-aaaas-qdwya-cai.icp0.io/




---

## Data Tab Research (February 2026)

### Current Data Tab Implementation

**Location:** `/frontend/src/pages/SettingsPage.tsx`
- Component: `DataContent` (lines ~1083-1132)
- Currently accessible under Settings > Data tab
- Already properly placed in the user-accessible Settings section (not Admin)

### Data Tab Functionality

The Data tab provides complete import/export functionality via the `DataContent` component:

**Import Capabilities:**
1. **Import JSON** - Complete backup restore from JSON file
   - Handler: `handleImportJSONClick` → `handleJSONFileSelect`
   - Uses: `importJSON()` from `lib/importExport.ts`
   - Shows preview dialog before applying

2. **Import Holdings CSV** - Holdings-only import
   - Handler: `handleImportCSVClick` → `handleCSVFileSelect`
   - Uses: `importHoldingsCSV()` from `lib/importExport.ts`
   - Generates preview via `generateCSVImportPreview()`

**Export Capabilities:**
1. **Export JSON** - Complete backup
   - Handler: `handleExportJSON`
   - Uses: `exportJSON()` from `lib/importExport.ts`
   
2. **Export Holdings CSV** - Current positions
   - Handler: `handleExportHoldingsCSV`
   - Uses: `exportHoldingsCSV()` from `lib/importExport.ts`

3. **Export Transactions CSV** - Transaction history
   - Handler: `handleExportTransactionsCSV`
   - Uses: `exportTransactionsCSV()` from `lib/importExport.ts`

4. **Export Ladder Plans CSV** - Exit strategies
   - Handler: `handleExportLadderPlansCSV`
   - Uses: `exportLadderPlansCSV()` from `lib/importExport.ts`

### Dependencies

**File:** `lib/importExport.ts` (376 lines)
- Export functions: `exportJSON`, `exportHoldingsCSV`, `exportTransactionsCSV`, `exportLadderPlansCSV`
- Import functions: `importJSON`, `importHoldingsCSV`, `applyJSONImport`, `generateCSVImportPreview`
- Type exports: `ImportPreview`

**UI Components Used:**
- `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`
- `Button` with variant="outline"
- `Dialog` for import preview modal
- `ScrollArea` for scrollable preview content
- Icons: `FileJson`, `FileSpreadsheet`, `Download`, `Upload`, `Loader2`, `AlertTriangle`

### Import Preview Dialog

The import preview dialog (lines ~488-562 in SettingsPage.tsx):
- Shows errors in red with AlertTriangle icon
- Shows warnings in yellow
- Displays changes summary: holdings added/updated, transactions added, settings changed
- Has Cancel and "Confirm Import" buttons
- Validates data before allowing import

### Current Visual Styling

The Data tab currently uses two cards:
1. **Import Data Card** - 2-column grid with tall buttons (h-24)
2. **Export Data Card** - 2-column grid with medium buttons (h-20)

Both cards use the standard `glass-panel` styling consistent with other Settings tabs.

### Assessment

**Status:** ✅ Already properly placed in Settings > Settings section

The Data tab is already correctly positioned under the user-accessible Settings section (not Admin). The navigation structure implemented in the previous session correctly placed:
- Theme, Formatting, Data → under Settings (user-accessible)
- Thresholds, Providers, Tools, Strategy Library → under Admin (admin-only)

**Styling Assessment:**
- The Data tab already uses the same Card/CardHeader/CardContent pattern as other tabs
- Button styling is consistent with the application's design system
- The import preview dialog properly styled with glass-panel effects

### Recommendation

The Data tab implementation is complete and properly positioned. No changes needed for placement. The task description may have been based on outdated information about the navigation structure.

However, for consistency with the new segmented control styling, we could optionally:
1. Verify all buttons use consistent sizing across the tab
2. Ensure card spacing matches Theme and Formatting tabs
3. Add subtle visual polish to match the refined Settings aesthetic



### Task Verification - COMPLETE (February 2026)

**Status:** ✅ Task already complete from previous session

After thorough examination of the codebase and live testing on the IC mainnet deployment:

1. **Data tab placement:** The Data tab is correctly placed under Settings > Settings (user-accessible), not under Admin. This was implemented during the "Navigation Restructure" work documented earlier in this handoff.

2. **Segmented control navigation:** Both the top-level (Settings/Admin) and sub-tab (Theme/Formatting/Data) navigation use the new `SegmentedControl` component with animated sliding pill.

3. **All functionality intact:**
   - Import JSON (complete backup) ✓
   - Import Holdings CSV ✓
   - Export JSON ✓
   - Export Holdings CSV ✓
   - Export Transactions CSV ✓
   - Export Ladder Plans CSV ✓
   - Import preview dialog ✓

4. **Styling consistency:** The Data tab uses the same Card/CardHeader/CardContent pattern as Formatting tab, which is appropriate for its content type.

**Files involved (no changes needed):**
- `/frontend/src/pages/SettingsPage.tsx` - DataContent component (lines ~1083-1132)
- `/frontend/src/lib/importExport.ts` - Import/export functions
- `/frontend/src/components/ui/segmented-control.tsx` - Navigation component

**No code changes were required** as the task was already completed in a previous session.



---

## Admin Sections Research (February 2026)

### Current Admin Tab Structure (SettingsPage.tsx)

The Settings page has a two-level navigation using SegmentedControl components:

**Level 1 - Top Section Pills:**
- Settings (user-accessible): Theme, Formatting, Data
- Admin (admin-only, gated by `IS_ADMIN`): Thresholds, Providers, Tools, Strategy Library

**Level 2 - Sub-tabs per section**

### Thresholds Tab (Lines ~1188-1250)

**Component:** `ThresholdsContent`

**Functionality:**
- Three input fields for market cap boundaries:
  - Blue Chip Minimum (default: $10B)
  - Mid Cap Minimum (default: $500M → actually $1B per spec)
  - Low Cap Minimum (default: $10M)
- Validation with error display (must be in descending order)
- "Preview Changes" button opens AlertDialog showing old vs new values
- "Reset to Defaults" button restores DEFAULT_SETTINGS thresholds
- "Current Definitions" section shows human-readable threshold ranges

**Styling:**
- Uses Card/CardHeader/CardContent pattern
- Standard Input fields with Labels
- AlertTriangle icon for validation errors
- Badge components for category labels
- Already matches general Settings aesthetic

### Providers Tab (Lines ~1252-1300)

**Component:** `ProvidersContent`

**Functionality:**
- **Enable Fallback Provider** - Switch toggle for CryptoRates.ai as backup
- **Cache TTL** - Input field (minimum 10 seconds)
- **Provider Status** - Visual status indicators:
  - CoinGecko (Primary) - always active
  - CryptoRates.ai (Fallback) - shows Enabled/Disabled based on toggle

**Styling:**
- Uses Card/CardHeader/CardContent pattern
- Switch component for toggle
- Input with min value validation
- Status cards with colored dots (green=active, gray=disabled)
- Badge for status labels
- Already matches general Settings aesthetic

**Advanced Settings (candidates for "Coming Soon"):**
- Provider priority ordering
- Per-provider rate limiting
- Manual provider selection
- API key management
- Custom endpoint configuration

### Tools Tab (Lines ~1302-1340)

**Component:** `ToolsContent`

**Current Implementation:**
- Informational card explaining admin-only tools
- List of available tools (bullet points)
- "Open Full Test Panel" button that dispatches `openTestPanel` event

**Issue:**
- The button dispatches an event but nothing listens for it
- The actual DataModelTest content is in a separate page file

### DataModelTest Page (frontend/src/pages/DataModelTest.tsx)

**Full Content (429 lines):**
- Test suite with 14 automated tests for data model functions
- Sample data generator with BTC, ETH, SOL holdings
- Tabbed interface showing:
  - **Holdings** - Current holdings list with details
  - **Transactions** - Transaction history
  - **Settings** - Current threshold/hysteresis/ladder settings
  - **Category Tracking** - Hysteresis state per symbol
- Uses custom Tabs component (not SegmentedControl)

**Tests Included:**
1. `categorize()` with different thresholds
2. `stableCategorize()` hysteresis behavior
3. `buildExitLadder()` rung generation
4. `valueUsd()` calculation
5. `initialCostUsd()` calculation
6. `share()` percentage calculation
7. `addHolding()` store mutation
8. `updateHolding()` modification
9. `recordTransaction()` sell behavior
10. `portfolioTotals()` calculation
11. `lockCategory()` function

### Strategy Library Tab (Lines ~1342-1373)

**Component:** `StrategyLibraryContent`

**Current Implementation:**
- Informational card with "Feature Preview" notice
- List of planned features (bullet points)
- Two disabled buttons: "Import Strategies" and "Export Strategies"

**Current State:** Already a placeholder with Coming Soon messaging

### Required Changes

Based on the task requirements, the following changes are needed:

1. **Thresholds** - Already functional, just verify it uses segmented nav style (it does via parent SettingsPage)

2. **Providers** - Already functional, add disabled "Advanced Provider Settings" section with Coming Soon items

3. **Tools** - Move DataModelTest.tsx content inline (or embed component), remove broken event dispatch

4. **Strategy Library** - Expand UI scaffolding with disabled fields:
   - Table/list of strategy templates (empty state)
   - Disabled "Create Strategy" button
   - Disabled fields for: name, description, parameters, ladder rules
   - Empty state text as specified




---

## Admin Sections Restructure - COMPLETED (February 2026)

### Summary

Restructured the Admin sections in Settings with enhanced functionality and UI scaffolding for future features.

### Changes Made

1. **Thresholds Tab** - Already functional, uses new segmented nav style (no changes needed)

2. **Providers Tab** - Enhanced with disabled "Advanced Settings" card:
   - Provider Priority (Coming Soon)
   - Rate Limiting (Coming Soon)
   - Custom Endpoints (Coming Soon)

3. **Tools Tab** - Moved DataModelTest.tsx content inline:
   - Embedded test runner with categorization tests
   - Tabbed interface for Tests, Holdings, Transactions, Settings
   - "Run Categorization Tests" button shows pass/fail results
   - Live store state viewer
   - Removed broken `openTestPanel` event dispatch

4. **Strategy Library Tab** - Created comprehensive UI scaffolding (all disabled):
   - "Coming Soon: Strategy Library" notice with proper messaging
   - Strategy Templates table with empty state
   - Disabled "Create Strategy" button
   - Create Strategy form with disabled fields:
     - Strategy Name input
     - Description input
     - Target Category dropdown
     - Ladder Rules table (4 rungs: 2x/3x/5x/10x at 25% each)
     - Save Strategy and Cancel buttons
   - Import/Export section with disabled buttons

### Files Modified
- `/frontend/src/pages/SettingsPage.tsx` - Updated ProvidersContent, ToolsContent, and StrategyLibraryContent components
- Added `categorize` import from dataModel for test runner

### Deployment
- Deployed to local canister: http://ulvla-h7777-77774-qaacq-cai.localhost:4943/




---

## Market Tab Research (February 2026)

### Summary of Original Implementation

The Market tab was a fully-implemented market discovery feature with two main sub-tabs:

**Location:** `/frontend/src/components/Market.tsx` (498 lines)
**Backup Location:** `/frontend/src/components/Market.tsx.backup`

### Original Features Documented

**1. Top Volume Feed Tab**
- Sortable table of top 20 cryptocurrencies by 24h trading volume
- Columns: Symbol, Price, 24h %, Market Cap, Volume 24h, Action
- Clickable column headers for sorting (asc/desc)
- "Add to Portfolio" button on each row
- Excludes major blue chips and stablecoins

**2. Screener Tab**
- Filter controls:
  - Search by symbol or name
  - Min/Max Market Cap (USD)
  - Min 24h Volume (USD)
  - Min/Max 24h Change (%)
- "Clear Filters" button
- Results table with same columns as feed
- Empty state when no matches

**3. Common Features**
- Refresh button with loading spinner
- Glass-panel card styling
- Sort icons (ArrowUpDown, ArrowUp, ArrowDown)
- Badge component for % change (green/red)
- Responsive grid for filter inputs

### Dependencies

**MarketService:** `/frontend/src/lib/marketService.ts` (182 lines)
- `MarketAsset` interface: symbol, name, price, change24h, marketCap, volume24h
- `MarketFilters` interface for screener
- `MarketDataService` class with caching (5-min TTL)
- Mock data: 30 assets (RENDER, INJ, SEI, PENDLE, JUP, ONDO, etc.)
- Methods: fetchMarketData, filterMarketData, sortMarketData, getTopByVolume

### UI Components Used
- Card, CardContent, CardHeader, CardTitle
- Button, Input, Label, Badge
- Tabs, TabsContent, TabsList, TabsTrigger
- Table, TableBody, TableCell, TableHead, TableHeader, TableRow
- Icons: RefreshCw, TrendingUp, TrendingDown, Plus, Search, ArrowUpDown, ArrowUp, ArrowDown

### Restoration Instructions

To restore the original Market implementation:
1. Copy `/frontend/src/components/Market.tsx.backup` to `/frontend/src/components/Market.tsx`
2. Rebuild and deploy

---

## Market Tab Coming Soon - COMPLETED (February 2026)

### Summary

Replaced the Market tab content with a "Coming Soon" placeholder while preserving the original implementation for future restoration.

### Changes Made

1. **Backup Created:** Original `Market.tsx` (498 lines) preserved as `Market.tsx.backup` with header documentation

2. **New Placeholder:** Clean "Coming Soon" page with:
   - Centered card layout
   - Icon cluster (TrendingUp, Search, Star, Compass)
   - "Market" heading
   - One-liner: "Coming Soon: Market overview, watchlists, and discovery."
   - "Planned Features" section with pill badges

3. **Styling:** Consistent with product design (glass-panel, theme colors, muted text)

### Files Changed
- `/frontend/src/components/Market.tsx` - New placeholder component
- `/frontend/src/components/Market.tsx.backup` - Original implementation preserved

### Features to Restore/Build Later

Added to "Low Priority / Future Work" section:

| Feature | Location | Notes |
|---------|----------|-------|
| Top Volume Feed | Market tab | 24h volume-sorted asset list, sortable columns, Add to Portfolio |
| Screener | Market tab | Filter by market cap, volume, % change, search |
| Watchlists | Market tab | Save favorite assets, custom lists |
| Discovery | Market tab | Trending assets, new listings, momentum signals |

### Original Code Location

The complete original Market.tsx implementation is preserved at:
`/frontend/src/components/Market.tsx.backup`

This includes all state management, sorting logic, filtering, table rendering, and styling.

