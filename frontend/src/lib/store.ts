/**
 * Portfolio Store - React State Management
 * 
 * Provides a React hook for accessing and modifying the portfolio store
 * with automatic persistence to localStorage.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
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
  calculateWeightedAverage,
} from './dataModel';
import { saveStore, loadStore, clearPersistedData, hasPersistedData } from './persistence';

// Initialize store from localStorage on module load
function initializeStore(): void {
  const persisted = loadStore();
  if (persisted) {
    Object.assign(globalStore, persisted);
    console.log('[Store] Loaded persisted data:', globalStore.holdings.length, 'holdings');
  } else {
    // Load mock data if no persisted data
    loadMockData();
  }
}

// Load mock data for first-time users
function loadMockData(): void {
  const mockCleared = localStorage.getItem('mock-data-cleared');
  if (mockCleared === 'true') {
    console.log('[Store] Mock data was previously cleared, starting fresh');
    return;
  }

  console.log('[Store] Loading mock data for first-time user');
  
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
    const volatility = Math.random() * 0.1 - 0.05; // ±5% weekly change
    const baseValue = 50000 * (1 + (365 - i) / 365 * 0.5); // Gradual growth over year
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

// Initialize on module load
initializeStore();

/**
 * Custom hook for accessing and modifying the portfolio store
 */
export function usePortfolioStore() {
  // Force re-render when store changes
  const [, setVersion] = useState(0);
  const forceUpdate = useCallback(() => setVersion(v => v + 1), []);

  // Get current store state
  const store = useMemo(() => getStore(), []);

  // Holdings accessor
  const holdings = useMemo(() => store.holdings, [store.holdings]);
  
  // Settings accessor
  const settings = useMemo(() => store.settings, [store.settings]);
  
  // Cash accessor
  const cash = useMemo(() => store.cash, [store.cash]);
  
  // Transactions accessor
  const transactions = useMemo(() => store.transactions, [store.transactions]);
  
  // Snapshots accessor
  const snapshots = useMemo(() => store.portfolioSnapshots, [store.portfolioSnapshots]);

  // Check if mock data has been cleared
  const isMockDataCleared = useMemo(() => {
    return localStorage.getItem('mock-data-cleared') === 'true';
  }, []);

  // Add or merge holding
  const addHolding = useCallback((
    symbol: string,
    tokensOwned: number,
    options?: {
      avgCost?: number;
      purchaseDate?: number;
      notes?: string;
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
    localStorage.setItem('mock-data-cleared', 'true');
    saveStore(globalStore);
    forceUpdate();
  }, [forceUpdate]);

  // Reset everything (including mock data flag)
  const resetAll = useCallback(() => {
    resetGlobalStore();
    clearPersistedData();
    localStorage.removeItem('mock-data-cleared');
    loadMockData();
    forceUpdate();
  }, [forceUpdate]);

  // Check if holding exists by symbol
  const findHoldingBySymbol = useCallback((symbol: string): Holding | undefined => {
    return globalStore.holdings.find(h => h.symbol.toUpperCase() === symbol.toUpperCase());
  }, []);

  return {
    // State
    holdings,
    settings,
    cash,
    transactions,
    snapshots,
    isMockDataCleared,
    
    // Actions
    addHolding,
    updateHolding,
    removeHolding,
    lockCategory,
    recordTransaction,
    recordSnapshot,
    setCash,
    updateSettings,
    getCategory,
    clearMockData,
    resetAll,
    findHoldingBySymbol,
    
    // Utilities
    calculateWeightedAverage,
  };
}

// Export types for convenience
export type { Store, Holding, Transaction, Category, Settings, PortfolioSnapshot };
