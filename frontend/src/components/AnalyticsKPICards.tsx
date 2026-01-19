import { memo, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { type Holding, type PortfolioSnapshot, getBestWorstMovers } from '@/lib/dataModel';

interface AnalyticsKPICardsProps {
  holdings: Holding[];
  prices: Record<string, number>;
  snapshots: PortfolioSnapshot[];
  currentTotal: number;
}

export const AnalyticsKPICards = memo(function AnalyticsKPICards({ 
  holdings, 
  prices, 
  snapshots, 
  currentTotal 
}: AnalyticsKPICardsProps) {
  const kpis = useMemo(() => {
    // Calculate 24h P&L
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const snapshot24h = snapshots.filter(s => s.timestamp >= oneDayAgo)[0];
    const pnl24h = snapshot24h ? currentTotal - snapshot24h.totalValue : 0;
    const pnl24hPercent = snapshot24h && snapshot24h.totalValue > 0 
      ? (pnl24h / snapshot24h.totalValue) * 100 
      : 0;

    // Calculate 7d P&L
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const snapshot7d = snapshots.filter(s => s.timestamp >= sevenDaysAgo)[0];
    const pnl7d = snapshot7d ? currentTotal - snapshot7d.totalValue : 0;
    const pnl7dPercent = snapshot7d && snapshot7d.totalValue > 0 
      ? (pnl7d / snapshot7d.totalValue) * 100 
      : 0;

    // Get best and worst movers
    const { best, worst } = getBestWorstMovers(holdings, prices);

    return [
      {
        label: '24h P&L',
        value: pnl24h,
        percent: pnl24hPercent,
        icon: pnl24h >= 0 ? TrendingUp : TrendingDown,
        positive: pnl24h >= 0,
      },
      {
        label: '7d P&L',
        value: pnl7d,
        percent: pnl7dPercent,
        icon: pnl7d >= 0 ? TrendingUp : TrendingDown,
        positive: pnl7d >= 0,
      },
      {
        label: 'Best Mover',
        value: best?.holding.symbol || '—',
        percent: best?.pnlPercent || 0,
        icon: ArrowUpRight,
        positive: true,
        isSymbol: true,
      },
      {
        label: 'Worst Mover',
        value: worst?.holding.symbol || '—',
        percent: worst?.pnlPercent || 0,
        icon: ArrowDownRight,
        positive: false,
        isSymbol: true,
      },
    ];
  }, [holdings, prices, snapshots, currentTotal]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        const isPositive = kpi.isSymbol ? kpi.percent >= 0 : kpi.positive;
        
        return (
          <Card key={index} className="glass-effect" style={{ transition: 'all 150ms ease-out' }}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  {kpi.isSymbol ? (
                    <div>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                      <p className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{kpi.percent.toFixed(1)}%
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}${Math.abs(kpi.value as number).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <p className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{kpi.percent.toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>
                <div className={`p-2 rounded-lg ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`} style={{ transition: 'background-color 150ms ease-out' }}>
                  <Icon className={`h-5 w-5 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});
