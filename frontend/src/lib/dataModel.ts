/**
 * Data Model & Input Logic for Crypto Portfolio Tracker
 * 
 * This module defines all entity types, pure helper functions, input logic,
 * and an in-memory store for portfolio management with hysteresis-based categorization.
 */

// ============================================================================
// ENTITY TYPES
// ============================================================================

export type Category = 
  | 'blue-chip'    // $10B+
  | 'mid-cap'      // $1B - $10B
  | 'low-cap'      // $10M - $1B
  | 'micro-cap'    // < $10M
  | 'stablecoin'
  | 'defi';

// Known stablecoins - will be auto-categorized regardless of market cap
// Includes major stablecoins and their staked/yield-bearing variants
export const KNOWN_STABLECOINS = new Set([
  // Major USD stablecoins
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'GUSD', 'FRAX', 'LUSD', 'USDD',
  'PYUSD', 'FDUSD', 'CUSD', 'EUSD', 'USDE', 'USDS', 'UST', 'MIM', 'DOLA', 'USDX',
  'SUSD', 'HUSD', 'USDJ', 'USDN', 'RSV', 'OUSD', 'MUSD', 'CRVUSD', 'GHUSD', 'USDM',
  // Staked/yield-bearing variants
  'SUSDT', 'SUSDC', 'SDAI', 'SUSDE', 'SUSDS', 'SFRAX', 'SFLUSD',
  'AUSDT', 'AUSDC', 'ADAI', // Aave variants
  'CUSDT', 'CUSDC', 'CDAI', // Compound variants
  // Other regional stablecoins
  'EURS', 'EURT', 'EUROC', 'AGEUR', // Euro stablecoins
  'XSGD', 'XIDR', 'XAUD', 'GYEN', 'JPYC', // Other fiat stablecoins
]);

/**
 * Check if a symbol is a known stablecoin
 */
export function isStablecoin(symbol: string): boolean {
  return KNOWN_STABLECOINS.has(symbol.toUpperCase());
}

export interface AssetMeta {
  symbol: string;
  name: string;
  marketCapUsd: number;
  volume24hUsd: number;
  priceUsd: number;
  change24h: number;
  lastUpdated: number;
}

export interface Holding {
  id: string;
  symbol: string;
  tokensOwned: number;
  avgCost?: number;
  purchaseDate?: number;
  notes?: string;
  categoryLocked?: boolean;
  lockedCategory?: Category;
}

export interface LadderRung {
  priceUsd: number;
  tokensToSell: number;
  percentOfTotal: number;
}

export interface LadderPreset {
  name: string;
  rungs: Array<{
    multiplier: number;  // e.g., 2x, 3x, 5x, 10x of avgCost
    percentOfTotal: number;
  }>;
}

export interface Settings {
  thresholds: {
    blueChipMin: number;      // $10B
    midCapMin: number;        // $1B (updated from $500M)
    lowCapMin: number;        // $10M
  };
  hysteresis: {
    percentBuffer: number;    // e.g., 10% - must cross by this much
    minHours: number;         // e.g., 24 - must stay across for this long
  };
  ladderPresets: {
    blue: LadderPreset;
    mid: LadderPreset;
    low: LadderPreset;
  };
}

export interface PriceQuote {
  symbol: string;
  priceUsd: number;
  timestamp: number;
}

export type TransactionType = 'buy' | 'sell' | 'transfer-in' | 'transfer-out';

export interface Transaction {
  id: string;
  type: TransactionType;
  symbol: string;
  tokens: number;
  priceUsd?: number;
  totalUsd?: number;
  timestamp: number;
  notes?: string;
}

export interface CategorySeenRecord {
  category: Category;
  seenAt: number;
}

export interface PortfolioSnapshot {
  timestamp: number;
  totalValue: number;
  blueChipValue: number;
  midCapValue: number;
  lowCapValue: number;
  microCapValue: number;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

export const DEFAULT_SETTINGS: Settings = {
  thresholds: {
    blueChipMin: 10_000_000_000,   // $10B
    midCapMin: 1_000_000_000,      // $1B (updated from $500M)
    lowCapMin: 10_000_000,         // $10M
  },
  hysteresis: {
    percentBuffer: 10,  // 10%
    minHours: 24,       // 24 hours
  },
  ladderPresets: {
    blue: {
      name: 'Blue Chip Exit Strategy',
      rungs: [
        { multiplier: 2, percentOfTotal: 25 },
        { multiplier: 3, percentOfTotal: 25 },
        { multiplier: 5, percentOfTotal: 25 },
        { multiplier: 10, percentOfTotal: 25 },
      ],
    },
    mid: {
      name: 'Mid Cap Exit Strategy',
      rungs: [
        { multiplier: 3, percentOfTotal: 20 },
        { multiplier: 5, percentOfTotal: 30 },
        { multiplier: 10, percentOfTotal: 30 },
        { multiplier: 20, percentOfTotal: 20 },
      ],
    },
    low: {
      name: 'Low Cap Exit Strategy',
      rungs: [
        { multiplier: 5, percentOfTotal: 15 },
        { multiplier: 10, percentOfTotal: 25 },
        { multiplier: 20, percentOfTotal: 30 },
        { multiplier: 50, percentOfTotal: 30 },
      ],
    },
  },
};

// ============================================================================
// PURE HELPER FUNCTIONS
// ============================================================================

/**
 * Categorize an asset based on market cap
 * Test: categorize(12e9, thresholds) → 'blue-chip'
 * Test: categorize(5e9, thresholds) → 'mid-cap'
 * Test: categorize(300e6, thresholds) → 'low-cap'
 */
export function categorize(
  marketCapUsd: number,
  thresholds: Settings['thresholds']
): Category {
  console.log(`[Categorize] MarketCap: $${(marketCapUsd / 1e9).toFixed(2)}B, Thresholds: Blue=${(thresholds.blueChipMin / 1e9).toFixed(0)}B, Mid=${(thresholds.midCapMin / 1e9).toFixed(2)}B, Low=${(thresholds.lowCapMin / 1e6).toFixed(0)}M`);
  
  if (marketCapUsd >= thresholds.blueChipMin) {
    console.log(`[Categorize] Result: blue-chip (>= $${(thresholds.blueChipMin / 1e9).toFixed(0)}B)`);
    return 'blue-chip';
  } else if (marketCapUsd >= thresholds.midCapMin) {
    console.log(`[Categorize] Result: mid-cap (>= $${(thresholds.midCapMin / 1e9).toFixed(2)}B)`);
    return 'mid-cap';
  } else if (marketCapUsd >= thresholds.lowCapMin) {
    console.log(`[Categorize] Result: low-cap (>= $${(thresholds.lowCapMin / 1e6).toFixed(0)}M)`);
    return 'low-cap';
  } else {
    console.log(`[Categorize] Result: micro-cap (< $${(thresholds.lowCapMin / 1e6).toFixed(0)}M)`);
    return 'micro-cap';
  }
}

/**
 * Stable categorization with hysteresis to prevent flickering
 * Only recategorize if:
 * 1. Market cap crosses threshold by percentBuffer, OR
 * 2. Asset remains across boundary for minHours
 */
export function stableCategorize(
  prevCategory: Category | null,
  prevSeenAt: number | null,
  newMarketCap: number,
  thresholds: Settings['thresholds'],
  hysteresis: Settings['hysteresis']
): CategorySeenRecord {
  const now = Date.now();
  const newCategory = categorize(newMarketCap, thresholds);

  // First time categorizing
  if (!prevCategory || !prevSeenAt) {
    console.log(`[StableCategorize] First time: ${newCategory}`);
    return { category: newCategory, seenAt: now };
  }

  // Same category - no change needed
  if (newCategory === prevCategory) {
    return { category: prevCategory, seenAt: prevSeenAt };
  }

  // Different category - check hysteresis conditions
  const hoursSinceChange = (now - prevSeenAt) / (1000 * 60 * 60);
  
  // Get the threshold that was crossed
  let thresholdCrossed = 0;
  if (prevCategory === 'blue-chip' && newCategory === 'mid-cap') {
    thresholdCrossed = thresholds.blueChipMin;
  } else if (prevCategory === 'mid-cap' && newCategory === 'blue-chip') {
    thresholdCrossed = thresholds.blueChipMin;
  } else if (prevCategory === 'mid-cap' && newCategory === 'low-cap') {
    thresholdCrossed = thresholds.midCapMin;
  } else if (prevCategory === 'low-cap' && newCategory === 'mid-cap') {
    thresholdCrossed = thresholds.midCapMin;
  } else if (prevCategory === 'low-cap' && newCategory === 'micro-cap') {
    thresholdCrossed = thresholds.lowCapMin;
  } else if (prevCategory === 'micro-cap' && newCategory === 'low-cap') {
    thresholdCrossed = thresholds.lowCapMin;
  }

  // Calculate how far we've crossed the threshold
  const percentDiff = Math.abs((newMarketCap - thresholdCrossed) / thresholdCrossed * 100);

  console.log(`[StableCategorize] Category change detected: ${prevCategory} → ${newCategory}, PercentDiff: ${percentDiff.toFixed(2)}%, Hours: ${hoursSinceChange.toFixed(2)}`);

  // Recategorize if crossed by buffer OR stayed across for minHours
  if (percentDiff >= hysteresis.percentBuffer || hoursSinceChange >= hysteresis.minHours) {
    console.log(`[StableCategorize] Accepting change (buffer: ${hysteresis.percentBuffer}%, minHours: ${hysteresis.minHours})`);
    return { category: newCategory, seenAt: now };
  }

  // Otherwise, keep previous category
  console.log(`[StableCategorize] Keeping previous category due to hysteresis`);
  return { category: prevCategory, seenAt: prevSeenAt };
}

/**
 * Calculate current USD value of a holding
 */
export function valueUsd(holding: Holding, price: number): number {
  return holding.tokensOwned * price;
}

/**
 * Calculate initial cost of a holding
 */
export function initialCostUsd(holding: Holding): number {
  if (!holding.avgCost) return 0;
  return holding.tokensOwned * holding.avgCost;
}

/**
 * Calculate percentage share of portfolio
 */
export function share(value: number, portfolioTotal: number): number {
  if (portfolioTotal === 0) return 0;
  return (value / portfolioTotal) * 100;
}

/**
 * Build exit ladder based on preset and average cost
 * Test: buildExitLadder for blue preset returns 4 rungs summing to 100% of tokens
 */
export function buildExitLadder(
  holding: Holding,
  preset: LadderPreset,
  avgCost: number
): LadderRung[] {
  return preset.rungs.map(rung => ({
    priceUsd: avgCost * rung.multiplier,
    tokensToSell: (holding.tokensOwned * rung.percentOfTotal) / 100,
    percentOfTotal: rung.percentOfTotal,
  }));
}

/**
 * Calculate portfolio totals
 */
export function portfolioTotals(
  holdings: Holding[],
  prices: Record<string, number>,
  cash: number
): {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  cash: number;
} {
  let totalValue = cash;
  let totalCost = 0;

  for (const holding of holdings) {
    const price = prices[holding.symbol] || 0;
    totalValue += valueUsd(holding, price);
    totalCost += initialCostUsd(holding);
  }

  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalPnL,
    totalPnLPercent,
    cash,
  };
}

/**
 * Calculate profit/loss metrics
 */
export function calculatePnL(currentValue: number, initialCost: number): {
  pnl: number;
  pnlPercent: number;
} {
  const pnl = currentValue - initialCost;
  const pnlPercent = initialCost > 0 ? (pnl / initialCost) * 100 : 0;
  return { pnl, pnlPercent };
}

/**
 * Get best and worst performing holdings
 */
export function getBestWorstMovers(
  holdings: Holding[],
  prices: Record<string, number>
): {
  best: { holding: Holding; pnlPercent: number } | null;
  worst: { holding: Holding; pnlPercent: number } | null;
} {
  let best: { holding: Holding; pnlPercent: number } | null = null;
  let worst: { holding: Holding; pnlPercent: number } | null = null;

  for (const holding of holdings) {
    if (!holding.avgCost) continue;
    
    const price = prices[holding.symbol];
    if (!price) continue;

    const currentValue = valueUsd(holding, price);
    const initialCost = initialCostUsd(holding);
    const { pnlPercent } = calculatePnL(currentValue, initialCost);

    if (!best || pnlPercent > best.pnlPercent) {
      best = { holding, pnlPercent };
    }

    if (!worst || pnlPercent < worst.pnlPercent) {
      worst = { holding, pnlPercent };
    }
  }

  return { best, worst };
}

/**
 * Calculate weighted average cost for position merging
 * Formula: newAvgCost = ((oldAvgCost * oldTokens) + (newCost * newTokens)) / (oldTokens + newTokens)
 * Test: calculateWeightedAverage(100, 10, 120, 5) → 106.67
 */
export function calculateWeightedAverage(
  oldAvgCost: number,
  oldTokens: number,
  newCost: number,
  newTokens: number
): number {
  if (oldTokens + newTokens === 0) return 0;
  return ((oldAvgCost * oldTokens) + (newCost * newTokens)) / (oldTokens + newTokens);
}

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

export interface Store {
  holdings: Holding[];
  settings: Settings;
  transactions: Transaction[];
  lastSeenCategories: Record<string, CategorySeenRecord>;
  portfolioSnapshots: PortfolioSnapshot[];
  cash: number;
}

export const store: Store = {
  holdings: [],
  settings: DEFAULT_SETTINGS,
  transactions: [],
  lastSeenCategories: {},
  portfolioSnapshots: [],
  cash: 0,
};

// ============================================================================
// INPUT LOGIC FUNCTIONS
// ============================================================================

let nextHoldingId = 1;
let nextTransactionId = 1;

/**
 * Add a new holding to the portfolio or merge with existing position
 * If symbol already exists, merge positions using weighted average cost
 */
export function addHolding(
  symbol: string,
  tokensOwned: number,
  options?: {
    avgCost?: number;
    purchaseDate?: number;
    notes?: string;
  }
): Holding {
  const normalizedSymbol = symbol.toUpperCase();
  
  // Check if holding already exists
  const existingHolding = store.holdings.find(h => h.symbol === normalizedSymbol);
  
  if (existingHolding) {
    // Merge positions using weighted average
    const oldTokens = existingHolding.tokensOwned;
    const oldAvgCost = existingHolding.avgCost || 0;
    const newCost = options?.avgCost || 0;
    
    // Calculate new weighted average cost
    const newAvgCost = calculateWeightedAverage(oldAvgCost, oldTokens, newCost, tokensOwned);
    
    // Update existing holding
    existingHolding.tokensOwned = oldTokens + tokensOwned;
    existingHolding.avgCost = newAvgCost;
    
    // Preserve existing metadata (lockedCategory, notes) unless new notes provided
    if (options?.notes) {
      existingHolding.notes = options.notes;
    }
    
    return existingHolding;
  }
  
  // Create new holding if symbol doesn't exist
  const holding: Holding = {
    id: `holding-${nextHoldingId++}`,
    symbol: normalizedSymbol,
    tokensOwned,
    avgCost: options?.avgCost,
    purchaseDate: options?.purchaseDate || Date.now(),
    notes: options?.notes,
  };

  store.holdings.push(holding);
  return holding;
}

/**
 * Update an existing holding
 */
export function updateHolding(
  id: string,
  partial: Partial<Omit<Holding, 'id' | 'symbol'>>
): Holding | null {
  const holding = store.holdings.find(h => h.id === id);
  if (!holding) return null;

  Object.assign(holding, partial);
  return holding;
}

/**
 * Lock or unlock category for a holding
 */
export function lockCategory(id: string, locked: boolean, category?: Category): Holding | null {
  const holding = store.holdings.find(h => h.id === id);
  if (!holding) return null;

  holding.categoryLocked = locked;
  if (locked && category) {
    holding.lockedCategory = category;
  } else {
    holding.lockedCategory = undefined;
  }

  return holding;
}

/**
 * Record a transaction and update holdings/cash accordingly
 * Test: recordTransaction of a sell reduces tokensOwned and increases cash
 */
export function recordTransaction(tx: Omit<Transaction, 'id'>): Transaction {
  const transaction: Transaction = {
    ...tx,
    id: `tx-${nextTransactionId++}`,
  };

  store.transactions.push(transaction);

  // Update holdings and cash based on transaction type
  const holding = store.holdings.find(h => h.symbol === tx.symbol.toUpperCase());

  switch (tx.type) {
    case 'buy':
      if (holding) {
        // Update existing holding with new average cost
        const currentValue = holding.tokensOwned * (holding.avgCost || 0);
        const newValue = tx.tokens * (tx.priceUsd || 0);
        const totalTokens = holding.tokensOwned + tx.tokens;
        holding.tokensOwned = totalTokens;
        holding.avgCost = (currentValue + newValue) / totalTokens;
      } else {
        // Create new holding
        addHolding(tx.symbol, tx.tokens, {
          avgCost: tx.priceUsd,
          purchaseDate: tx.timestamp,
        });
      }
      if (tx.totalUsd) {
        store.cash -= tx.totalUsd;
      }
      break;

    case 'sell':
      if (holding) {
        holding.tokensOwned -= tx.tokens;
        if (holding.tokensOwned <= 0) {
          // Remove holding if all tokens sold
          store.holdings = store.holdings.filter(h => h.id !== holding.id);
        }
      }
      if (tx.totalUsd) {
        store.cash += tx.totalUsd;
      }
      break;

    case 'transfer-in':
      if (holding) {
        holding.tokensOwned += tx.tokens;
      } else {
        addHolding(tx.symbol, tx.tokens, {
          avgCost: tx.priceUsd,
          purchaseDate: tx.timestamp,
        });
      }
      break;

    case 'transfer-out':
      if (holding) {
        holding.tokensOwned -= tx.tokens;
        if (holding.tokensOwned <= 0) {
          store.holdings = store.holdings.filter(h => h.id !== holding.id);
        }
      }
      break;
  }

  return transaction;
}

/**
 * Record a portfolio snapshot for performance tracking
 */
export function recordSnapshot(
  timestamp: number,
  totals: {
    blueChipValue: number;
    midCapValue: number;
    lowCapValue: number;
    microCapValue: number;
    totalValue: number;
  }
): PortfolioSnapshot {
  const snapshot: PortfolioSnapshot = {
    timestamp,
    totalValue: totals.totalValue,
    blueChipValue: totals.blueChipValue,
    midCapValue: totals.midCapValue,
    lowCapValue: totals.lowCapValue,
    microCapValue: totals.microCapValue,
  };

  store.portfolioSnapshots.push(snapshot);
  
  // Keep only last 365 days of snapshots
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  store.portfolioSnapshots = store.portfolioSnapshots.filter(s => s.timestamp >= oneYearAgo);

  return snapshot;
}

/**
 * Get or update category for a holding with hysteresis
 */
export function getCategoryForHolding(
  holding: Holding,
  marketCapUsd: number
): Category {
  // If category is locked, return locked category
  if (holding.categoryLocked && holding.lockedCategory) {
    console.log(`[GetCategory] ${holding.symbol}: Locked to ${holding.lockedCategory}`);
    return holding.lockedCategory;
  }

  // Check if it's a known stablecoin - these always go in stablecoin category
  if (isStablecoin(holding.symbol)) {
    console.log(`[GetCategory] ${holding.symbol}: Stablecoin (auto-detected)`);
    return 'stablecoin';
  }

  const prevRecord = store.lastSeenCategories[holding.symbol];
  const result = stableCategorize(
    prevRecord?.category || null,
    prevRecord?.seenAt || null,
    marketCapUsd,
    store.settings.thresholds,
    store.settings.hysteresis
  );

  console.log(`[GetCategory] ${holding.symbol}: ${result.category} (MarketCap: $${(marketCapUsd / 1e9).toFixed(2)}B)`);

  store.lastSeenCategories[holding.symbol] = result;
  return result.category;
}

// ============================================================================
// EXPORT STORE ACCESSOR
// ============================================================================

export function getStore(): Store {
  return store;
}

/**
 * Update cash amount in portfolio
 */
export function updateCash(amount: number): void {
  store.cash = Math.max(0, amount);
  console.log(`[Store] Cash updated to $${store.cash.toFixed(2)}`);
}

/**
 * Get current cash amount
 */
export function getCash(): number {
  return store.cash;
}

export function resetStore(): void {
  store.holdings = [];
  store.transactions = [];
  store.lastSeenCategories = {};
  store.portfolioSnapshots = [];
  store.cash = 0;
  nextHoldingId = 1;
  nextTransactionId = 1;
}
