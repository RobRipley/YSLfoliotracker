/**
 * Portfolio Snapshots Hook
 * 
 * Provides portfolio snapshot data for charts and analytics
 */

import { useMemo } from 'react';
import { usePortfolioStore, type PortfolioSnapshot } from '@/lib/store';
import { type Category } from '@/lib/dataModel';

export interface AllocationData {
  category: Category;
  value: number;
  percentage: number;
  color: string;
}

export interface TrendDataPoint {
  timestamp: number;
  date: string;
  value: number;
}

const CATEGORY_COLORS: Record<Category, string> = {
  'blue-chip': '#22d3ee',  // cyan
  'mid-cap': '#a78bfa',    // violet
  'low-cap': '#f472b6',    // pink
  'micro-cap': '#fbbf24',  // amber
  'stablecoin': '#4ade80', // green
  'defi': '#60a5fa',       // blue
};

export function usePortfolioSnapshots() {
  const { snapshots, holdings, cash } = usePortfolioStore();

  // Calculate current allocations from latest snapshot or fallback
  const allocations = useMemo((): AllocationData[] => {
    const latestSnapshot = snapshots[snapshots.length - 1];
    
    if (!latestSnapshot) {
      return [];
    }

    const totalValue = latestSnapshot.totalValue || 0;
    if (totalValue <= 0) return [];

    const result: AllocationData[] = [];

    if (latestSnapshot.blueChipValue > 0) {
      result.push({
        category: 'blue-chip',
        value: latestSnapshot.blueChipValue,
        percentage: (latestSnapshot.blueChipValue / totalValue) * 100,
        color: CATEGORY_COLORS['blue-chip'],
      });
    }

    if (latestSnapshot.midCapValue > 0) {
      result.push({
        category: 'mid-cap',
        value: latestSnapshot.midCapValue,
        percentage: (latestSnapshot.midCapValue / totalValue) * 100,
        color: CATEGORY_COLORS['mid-cap'],
      });
    }

    if (latestSnapshot.lowCapValue > 0) {
      result.push({
        category: 'low-cap',
        value: latestSnapshot.lowCapValue,
        percentage: (latestSnapshot.lowCapValue / totalValue) * 100,
        color: CATEGORY_COLORS['low-cap'],
      });
    }

    if (latestSnapshot.microCapValue > 0) {
      result.push({
        category: 'micro-cap',
        value: latestSnapshot.microCapValue,
        percentage: (latestSnapshot.microCapValue / totalValue) * 100,
        color: CATEGORY_COLORS['micro-cap'],
      });
    }

    return result;
  }, [snapshots]);

  // Get trend data for a specific category
  const getCategoryTrend = useMemo(() => {
    return (category: Category): TrendDataPoint[] => {
      return snapshots.map(snapshot => {
        let value = 0;
        switch (category) {
          case 'blue-chip':
            value = snapshot.blueChipValue;
            break;
          case 'mid-cap':
            value = snapshot.midCapValue;
            break;
          case 'low-cap':
            value = snapshot.lowCapValue;
            break;
          case 'micro-cap':
            value = snapshot.microCapValue;
            break;
        }
        return {
          timestamp: snapshot.timestamp,
          date: new Date(snapshot.timestamp).toLocaleDateString(),
          value,
        };
      });
    };
  }, [snapshots]);

  // Get total portfolio trend
  const totalTrend = useMemo((): TrendDataPoint[] => {
    return snapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      date: new Date(snapshot.timestamp).toLocaleDateString(),
      value: snapshot.totalValue,
    }));
  }, [snapshots]);

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    if (snapshots.length < 2) {
      return {
        change24h: 0,
        change24hPercent: 0,
        change7d: 0,
        change7dPercent: 0,
        change30d: 0,
        change30dPercent: 0,
      };
    }

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const current = snapshots[snapshots.length - 1].totalValue;
    
    const findClosestSnapshot = (targetTime: number): PortfolioSnapshot | null => {
      let closest: PortfolioSnapshot | null = null;
      let minDiff = Infinity;
      
      for (const snapshot of snapshots) {
        const diff = Math.abs(snapshot.timestamp - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closest = snapshot;
        }
      }
      
      return closest;
    };

    const snapshot24h = findClosestSnapshot(dayAgo);
    const snapshot7d = findClosestSnapshot(weekAgo);
    const snapshot30d = findClosestSnapshot(monthAgo);

    const calcChange = (oldValue: number | undefined): { change: number; percent: number } => {
      if (!oldValue || oldValue === 0) return { change: 0, percent: 0 };
      const change = current - oldValue;
      const percent = (change / oldValue) * 100;
      return { change, percent };
    };

    const change24h = calcChange(snapshot24h?.totalValue);
    const change7d = calcChange(snapshot7d?.totalValue);
    const change30d = calcChange(snapshot30d?.totalValue);

    return {
      change24h: change24h.change,
      change24hPercent: change24h.percent,
      change7d: change7d.change,
      change7dPercent: change7d.percent,
      change30d: change30d.change,
      change30dPercent: change30d.percent,
    };
  }, [snapshots]);

  return {
    snapshots,
    allocations,
    getCategoryTrend,
    totalTrend,
    performanceMetrics,
    categoryColors: CATEGORY_COLORS,
  };
}
