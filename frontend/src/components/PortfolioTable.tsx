import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import type { Holding } from '@/backend';

interface PortfolioTableProps {
  holdings: Holding[];
}

export function PortfolioTable({ holdings }: PortfolioTableProps) {
  const [sortBy, setSortBy] = useState<'ticker' | 'quantity' | 'value'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: 'ticker' | 'quantity' | 'value') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const sortedHoldings = [...holdings].sort((a, b) => {
    let aValue: number | string;
    let bValue: number | string;

    switch (sortBy) {
      case 'ticker':
        aValue = a.ticker;
        bValue = b.ticker;
        break;
      case 'quantity':
        aValue = a.quantity;
        bValue = b.quantity;
        break;
      case 'value':
        aValue = a.quantity * a.purchasePrice;
        bValue = b.quantity * b.purchasePrice;
        break;
      default:
        aValue = 0;
        bValue = 0;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
  });

  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">No holdings yet</p>
            <p className="text-sm text-muted-foreground">Add your first crypto holding to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('ticker')} className="h-auto p-0 font-semibold">
                  Asset
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('quantity')} className="h-auto p-0 font-semibold">
                  Quantity
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Avg Price</TableHead>
              <TableHead>Current Price</TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('value')} className="h-auto p-0 font-semibold">
                  Value
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>24h Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHoldings.map((holding, index) => {
              const currentPrice = holding.purchasePrice * (1 + Math.random() * 0.2 - 0.1); // Mock current price
              const value = holding.quantity * currentPrice;
              const change24h = (Math.random() - 0.5) * 10; // Mock 24h change
              const isPositive = change24h > 0;

              return (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold">{holding.ticker.slice(0, 2)}</span>
                      </div>
                      <span>{holding.ticker}</span>
                    </div>
                  </TableCell>
                  <TableCell>{holding.quantity.toFixed(6)}</TableCell>
                  <TableCell>${holding.purchasePrice.toLocaleString()}</TableCell>
                  <TableCell>${currentPrice.toLocaleString()}</TableCell>
                  <TableCell className="font-semibold">${value.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className={`flex items-center space-x-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <span>{isPositive ? '+' : ''}{change24h.toFixed(2)}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
