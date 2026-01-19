import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Holding } from '@/backend';

interface PortfolioPieChartProps {
  holdings: Holding[];
}

const COLORS = [
  'oklch(0.646 0.222 41.116)', // chart-1
  'oklch(0.6 0.118 184.704)',   // chart-2
  'oklch(0.398 0.07 227.392)',  // chart-3
  'oklch(0.828 0.189 84.429)',  // chart-4
  'oklch(0.769 0.188 70.08)',   // chart-5
];

export function PortfolioPieChart({ holdings }: PortfolioPieChartProps) {
  const [activeView, setActiveView] = useState<'individual' | 'category' | 'marketcap'>('individual');

  const getIndividualData = () => {
    return holdings.map((holding, index) => ({
      name: holding.ticker,
      value: holding.quantity * holding.purchasePrice,
      color: COLORS[index % COLORS.length],
    }));
  };

  const getCategoryData = () => {
    // Mock categorization - in real app, this would come from API
    const categories: Record<string, string[]> = {
      'DeFi': ['UNI', 'AAVE', 'COMP', 'SUSHI'],
      'Layer 1': ['BTC', 'ETH', 'ADA', 'SOL', 'DOT'],
      'Stablecoins': ['USDC', 'USDT', 'DAI'],
      'Meme': ['DOGE', 'SHIB'],
      'Other': []
    };

    const categoryTotals: Record<string, number> = {};
    
    holdings.forEach(holding => {
      let category = 'Other';
      for (const [cat, tickers] of Object.entries(categories)) {
        if (tickers.includes(holding.ticker)) {
          category = cat;
          break;
        }
      }
      
      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }
      categoryTotals[category] += holding.quantity * holding.purchasePrice;
    });

    return Object.entries(categoryTotals).map(([name, value], index) => ({
      name,
      value,
      color: COLORS[index % COLORS.length],
    }));
  };

  const getMarketCapData = () => {
    // Mock market cap classification
    const marketCapRanges: Record<string, string[]> = {
      'Blue Chips ($10B+)': ['BTC', 'ETH'],
      'Mid Caps ($500M-$10B)': ['ADA', 'SOL', 'DOT', 'UNI'],
      'Low Caps ($10M-$500M)': ['COMP', 'SUSHI'],
      'Micro Caps (<$10M)': [],
      'Stablecoins': ['USDC', 'USDT', 'DAI'],
      'DeFi': ['AAVE']
    };

    const rangeTotals: Record<string, number> = {};
    
    holdings.forEach(holding => {
      let range = 'Micro Caps (<$10M)';
      for (const [rangeName, tickers] of Object.entries(marketCapRanges)) {
        if (tickers.includes(holding.ticker)) {
          range = rangeName;
          break;
        }
      }
      
      if (!rangeTotals[range]) {
        rangeTotals[range] = 0;
      }
      rangeTotals[range] += holding.quantity * holding.purchasePrice;
    });

    return Object.entries(rangeTotals).map(([name, value], index) => ({
      name,
      value,
      color: COLORS[index % COLORS.length],
    }));
  };

  const getData = () => {
    switch (activeView) {
      case 'individual':
        return getIndividualData();
      case 'category':
        return getCategoryData();
      case 'marketcap':
        return getMarketCapData();
      default:
        return getIndividualData();
    }
  };

  const data = getData();

  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">No data to display</p>
            <p className="text-sm text-muted-foreground">Add holdings to see allocation charts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Allocation</CardTitle>
        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)}>
          <TabsList>
            <TabsTrigger value="individual">By Asset</TabsTrigger>
            <TabsTrigger value="category">By Category</TabsTrigger>
            <TabsTrigger value="marketcap">By Market Cap</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
