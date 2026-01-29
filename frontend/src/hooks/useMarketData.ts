/**
 * useMarketData Hook
 * 
 * React hook for accessing market data with automatic updates.
 * Provides stale-while-revalidate pattern for instant rendering.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  getMarketDataService, 
  initializeMarketData,
  type MarketData,
  type MarketCacheState 
} from '@/lib/marketDataService';
import { type Holding } from '@/lib/dataModel';

interface UseMarketDataReturn {
  // State
  isLoaded: boolean;
  isLoading: boolean;
  lastRefresh: number | null;
  coinCount: number;
  
  // Data accessors
  getMarketCap: (symbol: string) => number | undefined;
  getPrice: (symbol: string) => number | undefined;
  getData: (symbol: string) => MarketData | undefined;
  
  // For holdings: get best available market cap (live > cached > undefined)
  getMarketCapForHolding: (holding: Holding) => number | undefined;
  getPriceForHolding: (holding: Holding) => number | undefined;
  
  // Actions
  refreshSymbols: (symbols: string[]) => Promise<void>;
}

/**
 * Hook for accessing market data with React state updates
 */
export function useMarketData(): UseMarketDataReturn {
  const service = getMarketDataService();
  
  // Local state to trigger re-renders when cache updates
  const [cacheState, setCacheState] = useState<MarketCacheState>(service.getState());
  const [, setUpdateTrigger] = useState(0);

  // Initialize market data on mount
  useEffect(() => {
    initializeMarketData();
  }, []);

  // Subscribe to cache updates
  useEffect(() => {
    const unsubscribe = service.subscribe(() => {
      setCacheState(service.getState());
      setUpdateTrigger(n => n + 1); // Force re-render
    });
    
    return unsubscribe;
  }, [service]);

  // Data accessors (stable references)
  const getMarketCap = useCallback((symbol: string): number | undefined => {
    return service.getMarketCap(symbol);
  }, [service]);

  const getPrice = useCallback((symbol: string): number | undefined => {
    return service.getPrice(symbol);
  }, [service]);

  const getData = useCallback((symbol: string): MarketData | undefined => {
    return service.getData(symbol);
  }, [service]);

  const getMarketCapForHolding = useCallback((holding: Holding): number | undefined => {
    return service.getMarketCapForCategorization(holding);
  }, [service]);

  const getPriceForHolding = useCallback((holding: Holding): number | undefined => {
    return service.getPriceForRendering(holding);
  }, [service]);

  const refreshSymbols = useCallback(async (symbols: string[]): Promise<void> => {
    await service.refreshForSymbols(symbols);
  }, [service]);

  return {
    isLoaded: cacheState.isLoaded,
    isLoading: cacheState.isLoading,
    lastRefresh: cacheState.lastRefresh,
    coinCount: cacheState.coinCount,
    getMarketCap,
    getPrice,
    getData,
    getMarketCapForHolding,
    getPriceForHolding,
    refreshSymbols,
  };
}

/**
 * Hook for price data specific to a set of symbols
 * Automatically refreshes when symbols change
 */
export function usePricesForSymbols(symbols: string[]): {
  prices: Record<string, number>;
  marketCaps: Record<string, number>;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const { isLoaded, isLoading, getPrice, getMarketCap, refreshSymbols } = useMarketData();
  const [localLoading, setLocalLoading] = useState(!isLoaded);

  // Fetch prices for these specific symbols when they change
  useEffect(() => {
    if (symbols.length > 0) {
      setLocalLoading(true);
      refreshSymbols(symbols).finally(() => setLocalLoading(false));
    }
  }, [symbols.join(','), refreshSymbols]);

  // Build price and market cap maps
  const prices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const symbol of symbols) {
      const price = getPrice(symbol);
      if (price !== undefined) {
        map[symbol.toUpperCase()] = price;
      }
    }
    return map;
  }, [symbols, getPrice, isLoaded]);

  const marketCaps = useMemo(() => {
    const map: Record<string, number> = {};
    for (const symbol of symbols) {
      const cap = getMarketCap(symbol);
      if (cap !== undefined) {
        map[symbol.toUpperCase()] = cap;
      }
    }
    return map;
  }, [symbols, getMarketCap, isLoaded]);

  const refresh = useCallback(async () => {
    await refreshSymbols(symbols);
  }, [symbols, refreshSymbols]);

  return {
    prices,
    marketCaps,
    isLoading: isLoading || localLoading,
    refresh,
  };
}
