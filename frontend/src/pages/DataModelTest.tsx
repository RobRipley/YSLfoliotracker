import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  categorize,
  stableCategorize,
  valueUsd,
  initialCostUsd,
  share,
  buildExitLadder,
  portfolioTotals,
  addHolding,
  updateHolding,
  lockCategory,
  recordTransaction,
  getCategoryForHolding,
  getStore,
  resetStore,
  DEFAULT_SETTINGS,
  type Holding,
  type Category,
} from '@/lib/dataModel';
import { CheckCircle2, XCircle, PlayCircle } from 'lucide-react';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function DataModelTest() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [storeState, setStoreState] = useState(getStore());

  const runTests = () => {
    const results: TestResult[] = [];

    // Test 1: categorize function with blue chip threshold
    const blueChipCat = categorize(12e9, DEFAULT_SETTINGS.thresholds);
    results.push({
      name: 'categorize(12e9) → blue-chip',
      passed: blueChipCat === 'blue-chip',
      message: `Expected: blue-chip, Got: ${blueChipCat}`,
    });

    // Test 2: categorize function with mid cap threshold
    const midCapCat = categorize(5e9, DEFAULT_SETTINGS.thresholds);
    results.push({
      name: 'categorize(5e9) → mid-cap',
      passed: midCapCat === 'mid-cap',
      message: `Expected: mid-cap, Got: ${midCapCat}`,
    });

    // Test 3: categorize function with low cap threshold
    const lowCapCat = categorize(300e6, DEFAULT_SETTINGS.thresholds);
    results.push({
      name: 'categorize(300e6) → low-cap',
      passed: lowCapCat === 'low-cap',
      message: `Expected: low-cap, Got: ${lowCapCat}`,
    });

    // Test 4: categorize function with micro cap
    const microCapCat = categorize(5e6, DEFAULT_SETTINGS.thresholds);
    results.push({
      name: 'categorize(5e6) → micro-cap',
      passed: microCapCat === 'micro-cap',
      message: `Expected: micro-cap, Got: ${microCapCat}`,
    });

    // Test 5: stableCategorize with hysteresis (no change within buffer)
    const stableResult1 = stableCategorize(
      'mid-cap',
      Date.now() - 1000,
      9.5e9, // Just below blue chip threshold
      DEFAULT_SETTINGS.thresholds,
      DEFAULT_SETTINGS.hysteresis
    );
    results.push({
      name: 'stableCategorize maintains category within buffer',
      passed: stableResult1.category === 'mid-cap',
      message: `Expected: mid-cap, Got: ${stableResult1.category}`,
    });

    // Test 6: buildExitLadder for blue chip preset
    const mockHolding: Holding = {
      id: 'test-1',
      symbol: 'BTC',
      tokensOwned: 1,
      avgCost: 50000,
    };
    const ladder = buildExitLadder(mockHolding, DEFAULT_SETTINGS.ladderPresets.blue, 50000);
    const totalPercent = ladder.reduce((sum, rung) => sum + rung.percentOfTotal, 0);
    const totalTokens = ladder.reduce((sum, rung) => sum + rung.tokensToSell, 0);
    results.push({
      name: 'buildExitLadder returns 4 rungs summing to 100%',
      passed: ladder.length === 4 && totalPercent === 100 && Math.abs(totalTokens - 1) < 0.001,
      message: `Rungs: ${ladder.length}, Total %: ${totalPercent}, Total tokens: ${totalTokens.toFixed(3)}`,
    });

    // Test 7: valueUsd calculation
    const value = valueUsd(mockHolding, 60000);
    results.push({
      name: 'valueUsd calculates correctly',
      passed: value === 60000,
      message: `Expected: 60000, Got: ${value}`,
    });

    // Test 8: initialCostUsd calculation
    const cost = initialCostUsd(mockHolding);
    results.push({
      name: 'initialCostUsd calculates correctly',
      passed: cost === 50000,
      message: `Expected: 50000, Got: ${cost}`,
    });

    // Test 9: share calculation
    const sharePercent = share(25000, 100000);
    results.push({
      name: 'share calculates percentage correctly',
      passed: sharePercent === 25,
      message: `Expected: 25, Got: ${sharePercent}`,
    });

    // Test 10: addHolding function
    resetStore();
    const newHolding = addHolding('ETH', 10, { avgCost: 3000 });
    const store = getStore();
    results.push({
      name: 'addHolding adds to store',
      passed: store.holdings.length === 1 && store.holdings[0].symbol === 'ETH',
      message: `Holdings count: ${store.holdings.length}, Symbol: ${store.holdings[0]?.symbol}`,
    });

    // Test 11: updateHolding function
    const updated = updateHolding(newHolding.id, { tokensOwned: 15 });
    results.push({
      name: 'updateHolding modifies holding',
      passed: updated !== null && updated.tokensOwned === 15,
      message: `Expected tokens: 15, Got: ${updated?.tokensOwned}`,
    });

    // Test 12: recordTransaction (sell) reduces tokens and increases cash
    const initialCash = store.cash;
    const initialTokens = store.holdings[0].tokensOwned;
    recordTransaction({
      type: 'sell',
      symbol: 'ETH',
      tokens: 5,
      priceUsd: 3500,
      totalUsd: 17500,
      timestamp: Date.now(),
    });
    const finalCash = store.cash;
    const finalTokens = store.holdings[0].tokensOwned;
    results.push({
      name: 'recordTransaction (sell) updates holdings and cash',
      passed: finalTokens === initialTokens - 5 && finalCash === initialCash + 17500,
      message: `Tokens: ${initialTokens} → ${finalTokens}, Cash: ${initialCash} → ${finalCash}`,
    });

    // Test 13: portfolioTotals calculation
    const prices = { ETH: 3500 };
    const totals = portfolioTotals(store.holdings, prices, store.cash);
    results.push({
      name: 'portfolioTotals calculates correctly',
      passed: totals.totalValue > 0 && totals.cash === finalCash,
      message: `Total value: ${totals.totalValue}, Cash: ${totals.cash}`,
    });

    // Test 14: lockCategory function
    const locked = lockCategory(newHolding.id, true, 'blue-chip');
    results.push({
      name: 'lockCategory locks category',
      passed: locked !== null && locked.categoryLocked === true && locked.lockedCategory === 'blue-chip',
      message: `Locked: ${locked?.categoryLocked}, Category: ${locked?.lockedCategory}`,
    });

    setTestResults(results);
    setStoreState({ ...getStore() });
    console.log('Test Results:', results);
  };

  const addSampleData = () => {
    resetStore();
    // Add some sample holdings for testing
    addHolding('BTC', 1, { avgCost: 45000, notes: 'Sample Bitcoin holding' });
    addHolding('ETH', 10, { avgCost: 3000, notes: 'Sample Ethereum holding' });
    addHolding('SOL', 100, { avgCost: 50, notes: 'Sample Solana holding' });
    
    // Add a sample transaction
    recordTransaction({
      type: 'buy',
      symbol: 'BTC',
      tokens: 1,
      priceUsd: 45000,
      totalUsd: 45000,
      timestamp: Date.now(),
      notes: 'Initial BTC purchase',
    });
    
    setStoreState({ ...getStore() });
    console.log('Sample data added:', getStore());
  };

  useEffect(() => {
    // Log initial state
    console.log('DataModelTest component mounted');
    console.log('Initial store state:', getStore());
  }, []);

  const passedTests = testResults.filter(t => t.passed).length;
  const totalTests = testResults.length;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Data Model Test Suite</h1>
        <p className="text-muted-foreground">
          Testing all helper functions, input logic, and hysteresis behavior
        </p>
      </div>

      <div className="flex gap-4">
        <Button onClick={runTests} size="lg">
          <PlayCircle className="h-5 w-5 mr-2" />
          Run All Tests
        </Button>
        <Button onClick={addSampleData} variant="outline" size="lg">
          Add Sample Data
        </Button>
      </div>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Test Results: {passedTests}/{totalTests} Passed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    result.passed
                      ? 'bg-green-500/10 border-green-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                  }`}
                >
                  {result.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{result.name}</div>
                    <div className="text-sm text-muted-foreground">{result.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="holdings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="holdings">Holdings ({storeState.holdings.length})</TabsTrigger>
          <TabsTrigger value="transactions">Transactions ({storeState.transactions.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="categories">Category Tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings">
          <Card>
            <CardHeader>
              <CardTitle>Current Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              {storeState.holdings.length === 0 ? (
                <p className="text-muted-foreground">No holdings. Click "Add Sample Data" to populate.</p>
              ) : (
                <div className="space-y-4">
                  {storeState.holdings.map(holding => (
                    <div key={holding.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold text-lg">{holding.symbol}</div>
                          <div className="text-sm text-muted-foreground">ID: {holding.id}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{holding.tokensOwned.toLocaleString()} tokens</div>
                          {holding.avgCost && (
                            <div className="text-sm text-muted-foreground">
                              Avg Cost: ${holding.avgCost.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                      {holding.notes && (
                        <div className="text-sm text-muted-foreground mt-2">Note: {holding.notes}</div>
                      )}
                      {holding.categoryLocked && (
                        <div className="text-sm text-amber-500 mt-2">
                          🔒 Category locked: {holding.lockedCategory}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <div className="font-medium">Cash Balance</div>
                    <div className="text-2xl font-bold">${storeState.cash.toLocaleString()}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {storeState.transactions.length === 0 ? (
                <p className="text-muted-foreground">No transactions recorded.</p>
              ) : (
                <div className="space-y-2">
                  {storeState.transactions.map(tx => (
                    <div key={tx.id} className="p-3 border rounded-lg flex justify-between items-center">
                      <div>
                        <div className="font-medium">
                          {tx.type.toUpperCase()} {tx.tokens} {tx.symbol}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(tx.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        {tx.priceUsd && <div className="font-medium">${tx.priceUsd.toFixed(2)}</div>}
                        {tx.totalUsd && (
                          <div className="text-sm text-muted-foreground">Total: ${tx.totalUsd.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Current Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Market Cap Thresholds</h3>
                <div className="space-y-1 text-sm">
                  <div>Blue Chip: ${(storeState.settings.thresholds.blueChipMin / 1e9).toFixed(1)}B+</div>
                  <div>Mid Cap: ${(storeState.settings.thresholds.midCapMin / 1e6).toFixed(0)}M - ${(storeState.settings.thresholds.blueChipMin / 1e9).toFixed(1)}B</div>
                  <div>Low Cap: ${(storeState.settings.thresholds.lowCapMin / 1e6).toFixed(0)}M - ${(storeState.settings.thresholds.midCapMin / 1e6).toFixed(0)}M</div>
                  <div>Micro Cap: &lt; ${(storeState.settings.thresholds.lowCapMin / 1e6).toFixed(0)}M</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Hysteresis Settings</h3>
                <div className="space-y-1 text-sm">
                  <div>Percent Buffer: {storeState.settings.hysteresis.percentBuffer}%</div>
                  <div>Minimum Hours: {storeState.settings.hysteresis.minHours}h</div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Exit Ladder Presets</h3>
                {Object.entries(storeState.settings.ladderPresets).map(([key, preset]) => (
                  <div key={key} className="mb-3">
                    <div className="font-medium text-sm mb-1">{preset.name}</div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {preset.rungs.map((rung, i) => (
                        <div key={i}>
                          Rung {i + 1}: {rung.multiplier}x @ {rung.percentOfTotal}%
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Category Tracking (Hysteresis)</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(storeState.lastSeenCategories).length === 0 ? (
                <p className="text-muted-foreground">No category records yet.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(storeState.lastSeenCategories).map(([symbol, record]) => (
                    <div key={symbol} className="p-3 border rounded-lg flex justify-between items-center">
                      <div>
                        <div className="font-medium">{symbol}</div>
                        <div className="text-sm text-muted-foreground">
                          Category: {record.category}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Since: {new Date(record.seenAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
