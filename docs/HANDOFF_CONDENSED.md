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
