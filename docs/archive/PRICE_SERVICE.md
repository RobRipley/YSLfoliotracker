# Price Service - CryptoRates.ai Integration

## Overview

The new price service uses **CryptoRates.ai** (free, no rate limits) as the primary provider with **CoinGecko** as fallback. It's much simpler than the previous version and actually works in production!

## Features

✅ **Free & Unlimited** - No API keys, no rate limits  
✅ **5000+ Coins** - Covers all major cryptocurrencies  
✅ **Smart Caching** - 5-minute memory cache + localStorage persistence  
✅ **Fast Lookups** - Single fetch gets all coins, instant lookups after  
✅ **Market Data** - Includes price, market cap, volume, 24h change  
✅ **Fallback** - Automatically uses CoinGecko if CryptoRates fails  
✅ **Event System** - Emits events for significant price changes (>1%)  

## Basic Usage

```typescript
import { getPriceAggregator } from '@/lib/priceService';

// Get the global aggregator instance
const aggregator = getPriceAggregator();

// Fetch prices for multiple symbols
const quotes = await aggregator.getPrice(['BTC', 'ETH', 'SOL']);

quotes.forEach(quote => {
  console.log(`${quote.symbol}: $${quote.priceUsd}`);
  console.log(`Market Cap: $${quote.marketCapUsd}`);
});

// Get single price (convenience method)
const btcPrice = await aggregator.getCurrentPrice('BTC');
console.log(`BTC: $${btcPrice}`);
```

## Listen for Price Changes

```typescript
// Subscribe to price change events
const unsubscribe = aggregator.on((event) => {
  console.log(`${event.symbol} changed ${event.priceChangePercent}%`);
  console.log(`Old: $${event.oldPrice} → New: $${event.newPrice}`);
  
  if (event.marketCapChangePercent) {
    console.log(`Market cap changed ${event.marketCapChangePercent}%`);
  }
});

// Unsubscribe when done
unsubscribe();
```

## Mock Mode (Development)

```typescript
// Use mock data with random price updates
const aggregator = getPriceAggregator(true); // true = mock mode

// Mock provider simulates price changes every 5 seconds
// Great for testing UI animations and category changes
```

## How It Works

1. **First Call**: Fetches all 5000 coins from CryptoRates.ai (~500KB-1MB)
2. **Caching**: Stores in memory + localStorage for 5 minutes
3. **Lookups**: Subsequent calls use cached data (instant)
4. **Refresh**: Auto-refreshes every 5 minutes
5. **Persistence**: Survives page reloads via localStorage
6. **Fallback**: If CryptoRates fails, tries CoinGecko
7. **Stale Data**: If both fail, returns last known prices with `stale: true`

## Response Format

```typescript
interface ExtendedPriceQuote {
  symbol: string;           // 'BTC'
  priceUsd: number;         // 103000
  marketCapUsd?: number;    // 2040000000000
  volume24h?: number;       // Optional
  change24h?: number;       // Optional
  timestamp: number;        // Unix timestamp
  stale?: boolean;          // true if data is old/fallback
}
```

## Integration with Your Components

### Portfolio Dashboard

```typescript
import { getPriceAggregator } from '@/lib/priceService';

function PortfolioDashboard() {
  const aggregator = getPriceAggregator();
  const [prices, setPrices] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // Fetch prices for all holdings
    async function fetchPrices() {
      const symbols = holdings.map(h => h.symbol);
      const quotes = await aggregator.getPrice(symbols);
      
      const priceMap = new Map(
        quotes.map(q => [q.symbol, q.priceUsd])
      );
      setPrices(priceMap);
    }

    fetchPrices();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchPrices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [holdings]);

  // Use prices in your calculations
  const totalValue = holdings.reduce((sum, holding) => {
    const price = prices.get(holding.symbol) || 0;
    return sum + (holding.tokens * price);
  }, 0);
}
```

### Market Discovery

```typescript
function MarketDiscovery() {
  const aggregator = getPriceAggregator();
  const [marketData, setMarketData] = useState([]);

  useEffect(() => {
    async function loadMarket() {
      // Get top 50 coins by market cap
      const symbols = ['BTC', 'ETH', 'SOL', /* ... */];
      const quotes = await aggregator.getPrice(symbols);
      
      // Sort by market cap
      const sorted = quotes
        .filter(q => q.marketCapUsd)
        .sort((a, b) => (b.marketCapUsd || 0) - (a.marketCapUsd || 0));
      
      setMarketData(sorted);
    }
    
    loadMarket();
  }, []);
}
```

## Benefits Over Previous Version

| Feature | Old (564 lines) | New (478 lines) |
|---------|----------------|-----------------|
| Rate limits | Yes (50/min) | No limits |
| API keys | Needed for some | None needed |
| CORS issues | Possible | Works everywhere |
| Cache strategy | Complex | Simple & effective |
| Data freshness | Variable | 5-min guaranteed |
| localStorage | No | Yes |
| Market cap data | Sometimes | Always |
| Code complexity | High | Low |

## Testing

Run the test script in your browser console:

```typescript
import { testPriceService } from '@/lib/priceService.test';

testPriceService();
```

Or check localStorage after first use:
- Key: `cryptorates_cache`
- Value: Array of 5000+ coins with prices

## Troubleshooting

**Q: Prices aren't updating?**  
A: Check localStorage timestamp. Should refresh every 5 minutes.

**Q: Getting stale data?**  
A: Both CryptoRates and CoinGecko failed. Check network tab for errors.

**Q: Symbol not found?**  
A: CryptoRates has 5000 coins. Very obscure coins might not be included.

**Q: Want faster updates?**  
A: Change `cacheTTL` in CryptoRatesProvider constructor (currently 5 min).

## Migration Notes

Your existing code using `createProductionAggregator()` or `createMockAggregator()` will need to be updated to use `getPriceAggregator()` instead. The new API is simpler:

```typescript
// Old
const { aggregator } = createMockAggregator(true);

// New
const aggregator = getPriceAggregator(true);
```

All other methods (`getPrice()`, `getCurrentPrice()`, `on()`) remain the same.
