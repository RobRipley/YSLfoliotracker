import { TrendingUp, TrendingDown } from 'lucide-react';
import { type Holding, type PortfolioSnapshot, getBestWorstMovers } from '@/lib/dataModel';
import { type Category } from '@/lib/dataModel';
import { Sparkline } from './Sparkline';
import { CompactDonutRing } from './CompactDonutRing';

interface CompactMetricStripProps {
  totalValue: number;
  cash: number;
  holdings: Holding[];
  prices: Record<string, number>;
  snapshots: PortfolioSnapshot[];
  allocations: Record<Category, number>;
  onDonutClick: () => void;
}

export function CompactMetricStrip({
  totalValue,
  cash,
  holdings,
  prices,
  snapshots,
  allocations,
  onDonutClick
}: CompactMetricStripProps) {
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
    <div className="rounded-card glass-panel p-3 flex items-center gap-3 text-sm transition-smooth shadow-minimal flex-wrap">
      {/* Compact Donut Ring */}
      <div className="flex-shrink-0">
        <CompactDonutRing allocations={allocations} onClick={onDonutClick} />
      </div>

      <div className="h-8 w-px bg-border/50" />

      {/* Total Value Pill */}
      <div className="compact-padding rounded-chip glass-panel flex-shrink-0">
        <p className="text-xs text-muted-foreground font-medium">Total</p>
        <p className="font-semibold font-heading">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
      </div>

      <div className="h-8 w-px bg-border/50" />

      {/* 24h P&L Pill */}
      <div className="compact-padding rounded-chip glass-panel flex-shrink-0">
        <p className="text-xs text-muted-foreground font-medium">24h</p>
        <p className={`font-semibold font-heading flex items-center gap-1 ${pnl24h >= 0 ? 'text-neon-success' : 'text-neon-danger'}`}>
          {pnl24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {pnl24h >= 0 ? '+' : ''}{pnl24hPercent.toFixed(1)}%
        </p>
      </div>

      <div className="h-8 w-px bg-border/50" />

      {/* 7d P&L Pill */}
      <div className="compact-padding rounded-chip glass-panel flex-shrink-0">
        <p className="text-xs text-muted-foreground font-medium">7d</p>
        <p className={`font-semibold font-heading flex items-center gap-1 ${pnl7d >= 0 ? 'text-neon-success' : 'text-neon-danger'}`}>
          {pnl7d >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {pnl7d >= 0 ? '+' : ''}{pnl7dPercent.toFixed(1)}%
        </p>
      </div>

      <div className="h-8 w-px bg-border/50" />

      {/* Best Mover Pill */}
      <div className="compact-padding rounded-chip glass-panel flex-shrink-0">
        <p className="text-xs text-muted-foreground font-medium">Best</p>
        <p className="font-semibold font-heading text-neon-success">
          {best?.holding.symbol || '—'} {best ? `+${best.pnlPercent.toFixed(1)}%` : ''}
        </p>
      </div>

      <div className="h-8 w-px bg-border/50" />

      {/* Worst Mover Pill */}
      <div className="compact-padding rounded-chip glass-panel flex-shrink-0">
        <p className="text-xs text-muted-foreground font-medium">Worst</p>
        <p className="font-semibold font-heading text-neon-danger">
          {worst?.holding.symbol || '—'} {worst ? `${worst.pnlPercent.toFixed(1)}%` : ''}
        </p>
      </div>
    </div>
  );
}
