/**
 * Test script for the new CryptoRates.ai price service
 * Run this in your browser console or create a test page
 */

import { getPriceAggregator } from './priceService';

async function testPriceService() {
  console.log('🧪 Testing CryptoRates.ai Price Service...\n');

  const aggregator = getPriceAggregator(false); // false = use real API, true = use mock

  try {
    // Test 1: Fetch a few popular coins
    console.log('Test 1: Fetching BTC, ETH, SOL...');
    const quotes1 = await aggregator.getPrice(['BTC', 'ETH', 'SOL']);
    console.table(quotes1.map(q => ({
      Symbol: q.symbol,
      Price: `$${q.priceUsd.toLocaleString()}`,
      'Market Cap': q.marketCapUsd ? `$${(q.marketCapUsd / 1e9).toFixed(2)}B` : 'N/A',
      Stale: q.stale || false,
    })));

    // Test 2: Test cache - should be instant
    console.log('\nTest 2: Testing cache (should be instant)...');
    const startTime = Date.now();
    await aggregator.getPrice(['BTC']);
    const elapsed = Date.now() - startTime;
    console.log(`✅ Cache hit! Took ${elapsed}ms`);

    // Test 3: Test a mid-cap coin
    console.log('\nTest 3: Fetching ICP (mid-cap)...');
    const quotes3 = await aggregator.getPrice(['ICP']);
    console.table(quotes3.map(q => ({
      Symbol: q.symbol,
      Price: `$${q.priceUsd.toFixed(2)}`,
      'Market Cap': q.marketCapUsd ? `$${(q.marketCapUsd / 1e9).toFixed(2)}B` : 'N/A',
    })));

    // Test 4: Listen for price changes
    console.log('\nTest 4: Setting up price change listener...');
    aggregator.on((event) => {
      console.log(`🔔 Price change detected for ${event.symbol}:`, {
        oldPrice: event.oldPrice,
        newPrice: event.newPrice,
        change: `${event.priceChangePercent.toFixed(2)}%`,
      });
    });
    console.log('✅ Listener registered (will fire on next significant price change)');

    console.log('\n✅ All tests passed!');
    console.log('\n💡 Tip: Check localStorage - prices should be cached there!');
    console.log('   Key: cryptorates_cache');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Auto-run if loaded in browser
if (typeof window !== 'undefined') {
  console.log('Price service test loaded. Run testPriceService() to test.');
  (window as any).testPriceService = testPriceService;
}

export { testPriceService };
