import { TrendingUp, TrendingDown } from 'lucide-react';
import { type Holding, type PortfolioSnapshot, getBestWorstMovers } from '@/lib/dataModel';

interface FullWidthMetricTilesProps {
  totalValue: number;
  holdings: Holding[];
  prices: Record<string, number>;
  snapshots: PortfolioSnapshot[];
}

export function FullWidthMetricTiles({
  totalValue,
  holdings,
  prices,
  snapshots
}: FullWidthMetricTilesProps) {
  // Calculate 24h P&L
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const snapshot24h = snapshots.filter(s => s.timestamp >= oneDayAgo)[0];
  const pnl24h = snapshot24h ? totalValue - snapshot24h.totalValue : 0;
  const pnl24hPercent = snapshot24h && snapshot24h.totalValue > 0 
    ? (pnl24h / snapshot24h.totalValue) * 100 
    : 0;

  // Calculate 7d P&L
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const snapshot7d = snapshots.filter(s => s.timestamp >= sevenDaysAgo)[0];
  const pnl7d = snapshot7d ? totalValue - snapshot7d.totalValue : 0;
  const pnl7dPercent = snapshot7d && snapshot7d.totalValue > 0 
    ? (pnl7d / snapshot7d.totalValue) * 100 
    : 0;

  // Get best and worst movers
  const { best, worst } = getBestWorstMovers(holdings, prices);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Value Tile */}
      <div className="rounded-card glass-panel p-4 transition-smooth shadow-minimal">
        <p className="text-sm text-muted-foreground font-medium mb-2">Total</p>
        <p className="text-3xl font-bold font-heading">
          ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>

      {/* 24h P&L Tile */}
      <div className="rounded-card glass-panel p-4 transition-smooth shadow-minimal">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground font-medium">24h P&L</p>
          {pnl24h >= 0 ? (
            <TrendingUp className="h-5 w-5 text-neon-success" />
          ) : (
            <TrendingDown className="h-5 w-5 text-neon-danger" />
          )}
        </div>
        <p className={`text-3xl font-bold font-heading ${pnl24h >= 0 ? 'text-neon-success' : 'text-neon-danger'}`}>
          {pnl24h >= 0 ? '+' : ''}${Math.abs(pnl24h).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
        <p className={`text-sm font-medium mt-1 ${pnl24h >= 0 ? 'text-neon-success' : 'text-neon-danger'}`}>
          {pnl24h >= 0 ? '+' : ''}{pnl24hPercent.toFixed(2)}%
        </p>
      </div>

      {/* 7d P&L Tile */}
      <div className="rounded-card glass-panel p-4 transition-smooth shadow-minimal">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground font-medium">7d P&L</p>
          {pnl7d >= 0 ? (
            <TrendingUp className="h-5 w-5 text-neon-success" />
          ) : (
            <TrendingDown className="h-5 w-5 text-neon-danger" />
          )}
        </div>
        <p className={`text-3xl font-bold font-heading ${pnl7d >= 0 ? 'text-neon-success' : 'text-neon-danger'}`}>
          {pnl7d >= 0 ? '+' : ''}${Math.abs(pnl7d).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
        <p className={`text-sm font-medium mt-1 ${pnl7d >= 0 ? 'text-neon-success' : 'text-neon-danger'}`}>
          {pnl7d >= 0 ? '+' : ''}{pnl7dPercent.toFixed(2)}%
        </p>
      </div>

      {/* Best Mover Tile */}
      <div className="rounded-card glass-panel p-4 transition-smooth shadow-minimal">
        <p className="text-sm text-muted-foreground font-medium mb-2">Best Mover</p>
        <p className="text-3xl font-bold font-heading text-neon-success">
          {best?.holding.symbol || '—'}
        </p>
        {best && (
          <p className="text-sm font-medium mt-1 text-neon-success">
            +{best.pnlPercent.toFixed(1)}%
          </p>
        )}
      </div>

      {/* Worst Mover Tile */}
      <div className="rounded-card glass-panel p-4 transition-smooth shadow-minimal">
        <p className="text-sm text-muted-foreground font-medium mb-2">Worst Mover</p>
        <p className="text-3xl font-bold font-heading text-neon-danger">
          {worst?.holding.symbol || '—'}
        </p>
        {worst && (
          <p className="text-sm font-medium mt-1 text-neon-danger">
            {worst.pnlPercent.toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
}
