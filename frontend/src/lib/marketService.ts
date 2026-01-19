/**
 * Market Data Service for Crypto Portfolio Tracker
 * 
 * Provides market discovery data with filtering, sorting, and caching capabilities.
 */

export interface MarketAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
}

// Mock market data for development
const MOCK_MARKET_DATA: MarketAsset[] = [
  // High volume assets
  { symbol: 'RENDER', name: 'Render', price: 7.82, change24h: 15.2, marketCap: 3200000000, volume24h: 180000000 },
  { symbol: 'INJ', name: 'Injective', price: 23.45, change24h: 8.7, marketCap: 2100000000, volume24h: 95000000 },
  { symbol: 'SEI', name: 'Sei', price: 0.48, change24h: 22.1, marketCap: 1500000000, volume24h: 120000000 },
  { symbol: 'PENDLE', name: 'Pendle', price: 4.67, change24h: -3.2, marketCap: 890000000, volume24h: 85000000 },
  { symbol: 'JUP', name: 'Jupiter', price: 0.89, change24h: 18.5, marketCap: 1200000000, volume24h: 150000000 },
  { symbol: 'ONDO', name: 'Ondo', price: 1.12, change24h: 5.8, marketCap: 1800000000, volume24h: 75000000 },
  { symbol: 'WIF', name: 'dogwifhat', price: 2.34, change24h: -8.4, marketCap: 2300000000, volume24h: 210000000 },
  { symbol: 'BONK', name: 'Bonk', price: 0.000028, change24h: 12.7, marketCap: 1900000000, volume24h: 165000000 },
  { symbol: 'PYTH', name: 'Pyth Network', price: 0.42, change24h: 6.3, marketCap: 1400000000, volume24h: 92000000 },
  { symbol: 'TIA', name: 'Celestia', price: 5.67, change24h: -2.1, marketCap: 2800000000, volume24h: 110000000 },
  { symbol: 'ARB', name: 'Arbitrum', price: 0.78, change24h: 4.5, marketCap: 3100000000, volume24h: 145000000 },
  { symbol: 'OP', name: 'Optimism', price: 1.89, change24h: 7.2, marketCap: 2600000000, volume24h: 98000000 },
  { symbol: 'IMX', name: 'Immutable', price: 1.45, change24h: -5.6, marketCap: 2200000000, volume24h: 88000000 },
  { symbol: 'FTM', name: 'Fantom', price: 0.67, change24h: 9.8, marketCap: 1900000000, volume24h: 125000000 },
  { symbol: 'AAVE', name: 'Aave', price: 178.45, change24h: 3.4, marketCap: 2700000000, volume24h: 105000000 },
  { symbol: 'MKR', name: 'Maker', price: 1567.89, change24h: -1.8, marketCap: 1500000000, volume24h: 72000000 },
  { symbol: 'LDO', name: 'Lido DAO', price: 1.98, change24h: 11.2, marketCap: 1800000000, volume24h: 95000000 },
  { symbol: 'RUNE', name: 'THORChain', price: 4.23, change24h: -4.7, marketCap: 1400000000, volume24h: 68000000 },
  { symbol: 'FET', name: 'Fetch.ai', price: 1.34, change24h: 14.6, marketCap: 1600000000, volume24h: 115000000 },
  { symbol: 'GRT', name: 'The Graph', price: 0.23, change24h: 6.9, marketCap: 2100000000, volume24h: 89000000 },
  { symbol: 'SAND', name: 'The Sandbox', price: 0.52, change24h: 12.3, marketCap: 1200000000, volume24h: 180000000 },
  { symbol: 'MANA', name: 'Decentraland', price: 0.45, change24h: -6.2, marketCap: 890000000, volume24h: 95000000 },
  { symbol: 'AXS', name: 'Axie Infinity', price: 6.78, change24h: 8.1, marketCap: 1100000000, volume24h: 78000000 },
  { symbol: 'FLOW', name: 'Flow', price: 0.89, change24h: 4.3, marketCap: 1300000000, volume24h: 62000000 },
  { symbol: 'CHZ', name: 'Chiliz', price: 0.089, change24h: -3.5, marketCap: 780000000, volume24h: 55000000 },
  { symbol: 'ENJ', name: 'Enjin Coin', price: 0.34, change24h: 7.8, marketCap: 650000000, volume24h: 48000000 },
  { symbol: 'GALA', name: 'Gala', price: 0.045, change24h: 15.4, marketCap: 890000000, volume24h: 125000000 },
  { symbol: 'APE', name: 'ApeCoin', price: 1.23, change24h: -9.1, marketCap: 920000000, volume24h: 135000000 },
  { symbol: 'BLUR', name: 'Blur', price: 0.34, change24h: 5.6, marketCap: 680000000, volume24h: 72000000 },
  { symbol: 'DYDX', name: 'dYdX', price: 1.89, change24h: -2.4, marketCap: 750000000, volume24h: 58000000 },
];

export interface MarketFilters {
  minMarketCap?: number;
  maxMarketCap?: number;
  minVolume?: number;
  minChange1d?: number;
  maxChange1d?: number;
  minChange7d?: number;
  maxChange7d?: number;
  searchTerm?: string;
}

export type SortColumn = 'symbol' | 'name' | 'price' | 'change24h' | 'marketCap' | 'volume24h';
export type SortDirection = 'asc' | 'desc';

class MarketDataService {
  private cache: MarketAsset[] = [];
  private lastFetch: number = 0;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  async fetchMarketData(): Promise<MarketAsset[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.cache.length > 0 && now - this.lastFetch < this.cacheTTL) {
      return this.cache;
    }

    // In a real implementation, this would fetch from CoinGecko API via backend
    // For now, return mock data with slight randomization
    const data = MOCK_MARKET_DATA.map(asset => ({
      ...asset,
      price: asset.price * (1 + (Math.random() - 0.5) * 0.02),
      change24h: asset.change24h + (Math.random() - 0.5) * 2,
    }));

    this.cache = data;
    this.lastFetch = now;
    
    return data;
  }

  filterMarketData(data: MarketAsset[], filters: MarketFilters): MarketAsset[] {
    return data.filter(asset => {
      if (filters.minMarketCap && asset.marketCap < filters.minMarketCap) return false;
      if (filters.maxMarketCap && asset.marketCap > filters.maxMarketCap) return false;
      if (filters.minVolume && asset.volume24h < filters.minVolume) return false;
      if (filters.minChange1d && asset.change24h < filters.minChange1d) return false;
      if (filters.maxChange1d && asset.change24h > filters.maxChange1d) return false;
      
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesSymbol = asset.symbol.toLowerCase().includes(term);
        const matchesName = asset.name.toLowerCase().includes(term);
        if (!matchesSymbol && !matchesName) return false;
      }

      return true;
    });
  }

  sortMarketData(
    data: MarketAsset[], 
    column: SortColumn, 
    direction: SortDirection
  ): MarketAsset[] {
    const sorted = [...data].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (column) {
        case 'symbol':
          aVal = a.symbol;
          bVal = b.symbol;
          break;
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'price':
          aVal = a.price;
          bVal = b.price;
          break;
        case 'change24h':
          aVal = a.change24h;
          bVal = b.change24h;
          break;
        case 'marketCap':
          aVal = a.marketCap;
          bVal = b.marketCap;
          break;
        case 'volume24h':
          aVal = a.volume24h;
          bVal = b.volume24h;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return sorted;
  }

  getTopByVolume(limit: number = 20): Promise<MarketAsset[]> {
    return this.fetchMarketData().then(data => {
      const sorted = this.sortMarketData(data, 'volume24h', 'desc');
      return sorted.slice(0, limit);
    });
  }
}

// Singleton instance
let marketServiceInstance: MarketDataService | null = null;

export function getMarketService(): MarketDataService {
  if (!marketServiceInstance) {
    marketServiceInstance = new MarketDataService();
  }
  return marketServiceInstance;
}
