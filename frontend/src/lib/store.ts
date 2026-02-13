/**
 * Portfolio Store - React State Management
 * 
 * Provides a React hook for accessing and modifying the portfolio store
 * with automatic persistence to localStorage per user principal.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  type Store,
  type Holding,
  type Transaction,
  type Category,
  type Settings,
  type PortfolioSnapshot,
  store as globalStore,
  addHolding as addHoldingToStore,
  updateHolding as updateHoldingInStore,
  lockCategory as lockCategoryInStore,
  recordTransaction as recordTransactionInStore,
  recordSnapshot as recordSnapshotInStore,
  getCategoryForHolding,
  resetStore as resetGlobalStore,
  getStore,
  DEFAULT_SETTINGS,
  initializeIdCounters,
  calculateWeightedAverage,
} from './dataModel';
import {
  saveStore, 
  loadStore, 
  clearPersistedData, 
  hasPersistedData,
  setPrincipal,
  getCurrentPrincipal,
  isMockDataCleared,
  setMockDataCleared,
} from './persistence';
import { loadFromCanister, setActor as setSyncActor, queueCanisterSave, setHydrating, updateHashBaseline, setSyncPrincipal } from './canisterSync';
import type { BackendActor } from '../hooks/useActor';

// Track if store has been initialized for current session
let storeInitialized = false;

// Initialize store - called when principal is set
export function initializeStoreForPrincipal(principal: string | null): void {
  // Set principal in persistence module
  setPrincipal(principal);
  
  // Reset the global store first
  resetGlobalStore();
  
  // Try to load persisted data for this principal
  const persisted = loadStore();
  if (persisted) {
    Object.assign(globalStore, persisted);
    console.log('[Store] Loaded persisted data for principal:', principal?.slice(0, 8), 'with', globalStore.holdings.length, 'holdings');
    // Initialize ID counters from existing holdings to prevent duplicate IDs
    initializeIdCounters();
  } else {
    console.log('[Store] New user - starting with blank portfolio for principal:', principal?.slice(0, 8));
    // New users get a blank portfolio - no mock data loaded by default
  }
  
  storeInitialized = true;
}

/**
 * Connect the actor for canister sync and optionally load data from canister.
 * Called once the actor is ready (after auth + actor creation).
 * 
 * Uses hydration gate to prevent save→load→save feedback loop:
 * 1. Set isHydrating = true
 * 2. Load from canister, write to store + localStorage
 * 3. Set hash baseline to the hydrated state
 * 4. Set isHydrating = false
 * 
 * Returns true if canister data was loaded and store was updated.
 */
export async function connectCanisterSync(actor: BackendActor, principal: string): Promise<boolean> {
  // Wire up the sync service
  setSyncActor(actor);
  setSyncPrincipal(principal);
  
  // Set hash baseline for current local state BEFORE loading from canister
  // This way if canister has nothing, we won't re-save what's already there
  updateHashBaseline(globalStore);
  
  // Try to load from canister
  const canisterStore = await loadFromCanister(actor);
  
  if (canisterStore && canisterStore.holdings && canisterStore.holdings.length > 0) {
    const localCount = globalStore.holdings?.length || 0;
    const canisterCount = canisterStore.holdings.length;
    
    console.log('[Store] Canister has', canisterCount, 'holdings, localStorage has', localCount);
    
    // === HYDRATION GATE: suppress canister saves during restore ===
    setHydrating(true);
    
    resetGlobalStore();
    Object.assign(globalStore, canisterStore);
    initializeIdCounters();
    // Save to localStorage (but queueCanisterSave will be suppressed)
    saveStore(globalStore);
    
    // Set hash baseline to the hydrated state so the first price tick
    // after hydration doesn't trigger a canister save
    updateHashBaseline(globalStore);
    
    setHydrating(false);
    // === END HYDRATION GATE ===
    
    console.log('[Store] Loaded', canisterCount, 'holdings from canister');
    return true;
  } else if (!canisterStore || !canisterStore.holdings || canisterStore.holdings.length === 0) {
    // Canister is empty - if we have local data, push it up
    if (globalStore.holdings && globalStore.holdings.length > 0) {
      console.log('[Store] Canister empty, pushing', globalStore.holdings.length, 'local holdings to canister');
      // Temporarily clear the hash baseline so this save goes through
      updateHashBaseline({ ...globalStore, holdings: [] } as any);
      queueCanisterSave(globalStore);
    }
  }
  
  return false;
}

// Load mock data - only called explicitly by user action
function loadMockDataForUser(): void {
  if (isMockDataCleared()) {
    console.log('[Store] Mock data was previously cleared for this user');
    return;
  }

  console.log('[Store] Loading mock data (user-initiated)');
  
  // Blue chip assets
  addHoldingToStore('BTC', 0.25, { avgCost: 45000, notes: 'Bitcoin - Store of value' });
  addHoldingToStore('ETH', 5, { avgCost: 2200, notes: 'Ethereum - Smart contract platform' });
  addHoldingToStore('SOL', 50, { avgCost: 95, notes: 'Solana - High-performance L1' });
  
  // Mid cap assets  
  addHoldingToStore('RENDER', 200, { avgCost: 4.50, notes: 'AI/DePIN rendering' });
  addHoldingToStore('ONDO', 1000, { avgCost: 0.85, notes: 'RWA tokenization' });
  addHoldingToStore('ICP', 150, { avgCost: 8.50, notes: 'Internet Computer Protocol' });
  
  // Low cap assets
  addHoldingToStore('KMNO', 25000, { avgCost: 0.04, notes: 'Kamino Finance' });
  addHoldingToStore('DEEP', 30000, { avgCost: 0.08, notes: 'DeepBook Protocol' });
  
  // Set some cash
  globalStore.cash = 5000;
  
  // Generate mock historical snapshots
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  for (let i = 365; i >= 0; i -= 7) {
    const timestamp = now - (i * oneDay);
    const volatility = Math.random() * 0.1 - 0.05;
    const baseValue = 50000 * (1 + (365 - i) / 365 * 0.5);
    const totalValue = baseValue * (1 + volatility);
    
    recordSnapshotInStore(timestamp, {
      totalValue,
      blueChipValue: totalValue * 0.55,
      midCapValue: totalValue * 0.30,
      lowCapValue: totalValue * 0.10,
      microCapValue: totalValue * 0.05,
    });
  }
  
  // Save initial mock data
  saveStore(globalStore);
}

/**
 * Custom hook for accessing and modifying the portfolio store
 * Now principal-aware - each user gets their own portfolio
 * Optionally syncs with the ICP backend canister for cross-device persistence
 */
export function usePortfolioStore(principal?: string | null, actor?: BackendActor | null) {
  // Force re-render when store changes
  const [version, setVersion] = useState(0);
  const forceUpdate = useCallback(() => setVersion(v => v + 1), []);
  
  // Track current principal
  const lastPrincipal = useRef<string | null | undefined>(undefined);
  
  // Track whether canister sync has been done for this session
  const canisterSynced = useRef(false);

  // Initialize store when principal changes
  useEffect(() => {
    if (lastPrincipal.current !== principal) {
      console.log('[Store Hook] Principal changed:', lastPrincipal.current?.slice(0, 8), '->', principal?.slice(0, 8));
      lastPrincipal.current = principal;
      canisterSynced.current = false; // Reset sync flag on principal change
      
      if (principal && principal !== '2vxsx-fae') {
        initializeStoreForPrincipal(principal);
        forceUpdate();
      } else if (principal === null) {
        // User logged out - clear store
        resetGlobalStore();
        setSyncActor(null);
        setSyncPrincipal(null);
        forceUpdate();
      }
    }
  }, [principal, forceUpdate]);

  // Connect canister sync when actor becomes available
  useEffect(() => {
    if (actor && principal && principal !== '2vxsx-fae' && !canisterSynced.current) {
      canisterSynced.current = true;
      connectCanisterSync(actor, principal).then(updated => {
        if (updated) {
          console.log('[Store Hook] Store updated from canister data');
          forceUpdate();
        }
      });
    } else if (!actor) {
      setSyncActor(null);
    }
  }, [actor, principal, forceUpdate]);

  // Get current store state
  const store = useMemo(() => getStore(), [version]);

  // Holdings accessor - spread to create new array reference on version change
  // This ensures React detects changes when holdings are mutated
  const holdings = useMemo(() => [...store.holdings], [store.holdings, version]);
  
  // Settings accessor
  const settings = useMemo(() => store.settings, [store.settings, version]);
  
  // Cash accessor
  const cash = useMemo(() => store.cash, [store.cash, version]);
  
  // Cash notes accessor
  const cashNotes = useMemo(() => store.cashNotes || '', [store.cashNotes, version]);
  
  // Transactions accessor
  const transactions = useMemo(() => store.transactions, [store.transactions, version]);
  
  // Snapshots accessor
  const snapshots = useMemo(() => store.portfolioSnapshots, [store.portfolioSnapshots, version]);

  // Check if mock data has been cleared
  const mockDataCleared = useMemo(() => isMockDataCleared(), [version]);

  // Add or merge holding
  const addHolding = useCallback((
    symbol: string,
    tokensOwned: number,
    options?: {
      avgCost?: number;
      purchaseDate?: number;
      notes?: string;
      coingeckoId?: string;
      logoUrl?: string;
    }
  ) => {
    const holding = addHoldingToStore(symbol, tokensOwned, options);
    saveStore(globalStore);
    forceUpdate();
    return holding;
  }, [forceUpdate]);

  // Update existing holding
  const updateHolding = useCallback((
    id: string,
    partial: Partial<Omit<Holding, 'id' | 'symbol'>>
  ) => {
    const holding = updateHoldingInStore(id, partial);
    if (holding) {
      saveStore(globalStore);
      forceUpdate();
    }
    return holding;
  }, [forceUpdate]);

  // Remove holding
  const removeHolding = useCallback((id: string) => {
    const index = globalStore.holdings.findIndex(h => h.id === id);
    if (index !== -1) {
      globalStore.holdings.splice(index, 1);
      saveStore(globalStore);
      forceUpdate();
    }
  }, [forceUpdate]);

  // Lock/unlock category
  const lockCategory = useCallback((
    id: string,
    locked: boolean,
    category?: Category
  ) => {
    const holding = lockCategoryInStore(id, locked, category);
    if (holding) {
      saveStore(globalStore);
      forceUpdate();
    }
    return holding;
  }, [forceUpdate]);

  // Record transaction
  const recordTransaction = useCallback((
    tx: Omit<Transaction, 'id'>
  ) => {
    const transaction = recordTransactionInStore(tx);
    saveStore(globalStore);
    forceUpdate();
    return transaction;
  }, [forceUpdate]);

  // Record snapshot
  const recordSnapshot = useCallback((
    timestamp: number,
    totals: {
      blueChipValue: number;
      midCapValue: number;
      lowCapValue: number;
      microCapValue: number;
      totalValue: number;
    }
  ) => {
    const snapshot = recordSnapshotInStore(timestamp, totals);
    saveStore(globalStore);
    forceUpdate();
    return snapshot;
  }, [forceUpdate]);

  // Update cash
  const setCash = useCallback((amount: number) => {
    globalStore.cash = amount;
    saveStore(globalStore);
    forceUpdate();
  }, [forceUpdate]);

  // Update cash notes
  const setCashNotes = useCallback((notes: string) => {
    globalStore.cashNotes = notes;
    saveStore(globalStore);
    forceUpdate();
  }, [forceUpdate]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    Object.assign(globalStore.settings, newSettings);
    saveStore(globalStore);
    forceUpdate();
  }, [forceUpdate]);

  // Get category for holding (with hysteresis)
  const getCategory = useCallback((holding: Holding, marketCapUsd: number): Category => {
    return getCategoryForHolding(holding, marketCapUsd);
  }, []);

  // Clear mock data
  const clearMockData = useCallback(() => {
    resetGlobalStore();
    setMockDataCleared(true);
    saveStore(globalStore);
    forceUpdate();
  }, [forceUpdate]);

  // Load sample data (explicit user action)
  const loadSampleData = useCallback(() => {
    loadMockDataForUser();
    forceUpdate();
  }, [forceUpdate]);

  // Reset everything (including mock data flag)
  const resetAll = useCallback(() => {
    resetGlobalStore();
    clearPersistedData();
    setMockDataCleared(false);
    forceUpdate();
  }, [forceUpdate]);

  // Check if holding exists by symbol
  const findHoldingBySymbol = useCallback((symbol: string): Holding | undefined => {
    return globalStore.holdings.find(h => h.symbol.toUpperCase() === symbol.toUpperCase());
  }, [version]);

  return {
    // State
    holdings,
    settings,
    cash,
    cashNotes,
    transactions,
    snapshots,
    isMockDataCleared: mockDataCleared,
    
    // Actions
    addHolding,
    updateHolding,
    removeHolding,
    lockCategory,
    recordTransaction,
    recordSnapshot,
    setCash,
    setCashNotes,
    updateSettings,
    getCategory,
    clearMockData,
    loadSampleData,
    resetAll,
    findHoldingBySymbol,
    
    // Utilities
    calculateWeightedAverage,
  };
}

// Export types for convenience
export type { Store, Holding, Transaction, Category, Settings, PortfolioSnapshot };
