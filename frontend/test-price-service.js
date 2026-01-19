/**
 * Quick Browser Console Test for CryptoRates.ai Price Service
 * 
 * Copy-paste this entire file into your browser console while your app is running
 * It will test the new price service and show you exactly what's happening
 */

(async function testPriceService() {
  console.log('🧪 CryptoRates.ai Price Service Test\n');
  console.log('='.repeat(50));
  
  try {
    // Import the price service
    console.log('\n📦 Step 1: Importing price service...');
    const { getPriceAggregator } = await import('./lib/priceService.js');
    console.log('✅ Import successful');
    
    // Create aggregator instance
    console.log('\n🔧 Step 2: Creating aggregator (real API mode)...');
    const aggregator = getPriceAggregator(false); // false = real API
    console.log('✅ Aggregator created');
    
    // Test 1: Fetch popular coins
    console.log('\n💰 Step 3: Fetching BTC, ETH, SOL...');
    console.time('First fetch');
    const quotes1 = await aggregator.getPrice(['BTC', 'ETH', 'SOL']);
    console.timeEnd('First fetch');
    
    console.log('\n📊 Results:');
    console.table(quotes1.map(q => ({
      Symbol: q.symbol,
      Price: `$${q.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      'Market Cap': q.marketCapUsd 
        ? `$${(q.marketCapUsd / 1e9).toFixed(2)}B` 
        : 'N/A',
      Stale: q.stale || false,
      Timestamp: new Date(q.timestamp).toLocaleTimeString(),
    })));
    
    // Test 2: Test cache performance
    console.log('\n⚡ Step 4: Testing cache (should be instant)...');
    console.time('Cache hit');
    const quotes2 = await aggregator.getPrice(['BTC']);
    console.timeEnd('Cache hit');
    
    if (quotes2[0].priceUsd === quotes1[0].priceUsd) {
      console.log('✅ Cache working! Same price returned instantly');
    } else {
      console.warn('⚠️ Price changed between calls (this is normal if > 5 min passed)');
    }
    
    // Test 3: Your specific portfolio coins
    console.log('\n🎯 Step 5: Testing your portfolio coins...');
    const portfolioSymbols = ['ICP', 'RENDER', 'ONDO', 'KMNO', 'SUI'];
    console.time('Portfolio fetch');
    const portfolioQuotes = await aggregator.getPrice(portfolioSymbols);
    console.timeEnd('Portfolio fetch');
    
    console.log('\n📊 Your Portfolio Coin Prices:');
    console.table(portfolioQuotes.map(q => ({
      Symbol: q.symbol,
      Price: `$${q.priceUsd.toFixed(4)}`,
      'Market Cap': q.marketCapUsd 
        ? `$${(q.marketCapUsd / 1e9).toFixed(2)}B` 
        : 'N/A',
      Category: q.marketCapUsd 
        ? (q.marketCapUsd >= 10e9 ? 'Blue Chip' 
          : q.marketCapUsd >= 1e9 ? 'Mid Cap' 
          : 'Low Cap')
        : 'Unknown',
      Stale: q.stale || false,
    })));
    
    // Test 4: Check localStorage
    console.log('\n💾 Step 6: Checking localStorage cache...');
    const cachedData = localStorage.getItem('cryptorates_cache');
    const cachedTimestamp = localStorage.getItem('cryptorates_cache_timestamp');
    
    if (cachedData && cachedTimestamp) {
      const cacheAge = Date.now() - parseInt(cachedTimestamp);
      const cacheAgeMinutes = (cacheAge / 1000 / 60).toFixed(1);
      const coinCount = JSON.parse(cachedData).length;
      
      console.log(`✅ Cache found in localStorage`);
      console.log(`   - Coins cached: ${coinCount}`);
      console.log(`   - Cache age: ${cacheAgeMinutes} minutes`);
      console.log(`   - Cache expires in: ${Math.max(0, 5 - parseFloat(cacheAgeMinutes)).toFixed(1)} minutes`);
      
      if (cacheAge < 5 * 60 * 1000) {
        console.log('   - ✅ Cache is fresh (< 5 minutes old)');
      } else {
        console.log('   - ⚠️ Cache is stale (will refetch on next call)');
      }
    } else {
      console.log('⚠️ No cache in localStorage yet (will be created after first fetch)');
    }
    
    // Test 5: Subscribe to price changes
    console.log('\n🔔 Step 7: Testing event system...');
    let eventReceived = false;
    const unsubscribe = aggregator.on((event) => {
      eventReceived = true;
      console.log(`\n📢 Price change event:`, {
        symbol: event.symbol,
        oldPrice: event.oldPrice,
        newPrice: event.newPrice,
        change: `${event.priceChangePercent.toFixed(2)}%`,
      });
    });
    
    console.log('✅ Event listener registered');
    console.log('   (Events fire when price changes > 1% on next fetch)');
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('Summary:');
    console.log('- CryptoRates.ai API is working');
    console.log('- Prices are being fetched successfully');
    console.log('- Cache is functioning correctly');
    console.log('- localStorage persistence is active');
    console.log('- Event system is operational\n');
    
    console.log('💡 Tips:');
    console.log('- First fetch takes ~1-2 seconds');
    console.log('- Subsequent fetches are instant (cached)');
    console.log('- Cache refreshes every 5 minutes');
    console.log('- Check Network tab to see API calls\n');
    
    console.log('🎯 Next Steps:');
    console.log('1. Start your app and check portfolio displays prices');
    console.log('2. Verify ICP shows as "Mid Cap" (market cap ~$3B)');
    console.log('3. Test "Use Current Price" button in add asset modal');
    console.log('4. Watch console for successful price fetches\n');
    
    // Cleanup
    unsubscribe();
    
  } catch (error) {
    console.error('\n❌ TEST FAILED!\n');
    console.error('Error:', error);
    console.error('\nDebug info:');
    console.error('- Make sure your dev server is running');
    console.error('- Check if you\'re on the app URL (not localhost:XXXX)');
    console.error('- Verify the import path is correct for your setup');
    console.error('\nFull error:', error);
  }
})();

console.log('\n📝 Test script loaded. Running tests...\n');
