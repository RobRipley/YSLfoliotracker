import { memo, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Target, TrendingUp, ArrowRight } from 'lucide-react';
import type { Holding } from '@/lib/dataModel';
import type { ExtendedPriceQuote } from '@/lib/priceService';
import type { ExitPlanState } from '@/lib/exitPlanPersistence';

interface NearestExitsProps {
  holdings: Holding[];
  prices: Record<string, ExtendedPriceQuote>;
  exitPlans: Record<string, ExitPlanState>;
}

interface NearestExit {
  holdingId: string;
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  percentAway: number;
  tokensToSell: number;
  rungIndex: number;
}

export const NearestExits = memo(function NearestExits({
  holdings,
  prices,
  exitPlans,
}: NearestExitsProps) {
  const nearestExits = useMemo(() => {
    const exits: NearestExit[] = [];

    for (const holding of holdings) {
      const plan = exitPlans[holding.id];
      if (!plan || !plan.rungs || plan.rungs.length === 0) continue;

      const priceData = prices[holding.symbol.toUpperCase()];
      const currentPrice = priceData?.priceUsd ?? holding.avgCost ?? 0;
      if (currentPrice <= 0) continue;

      // Find the next rung that hasn't been hit yet (target price > current price)
      for (let i = 0; i < plan.rungs.length; i++) {
        const rung = plan.rungs[i];
        const targetPrice = rung.targetPrice ?? 0;
        
        if (targetPrice > currentPrice) {
          const percentAway = ((targetPrice - currentPrice) / currentPrice) * 100;
          exits.push({
            holdingId: holding.id,
            symbol: holding.symbol.toUpperCase(),
            currentPrice,
            targetPrice,
            percentAway,
            tokensToSell: rung.tokensToSell ?? 0,
            rungIndex: i,
          });
          break; // Only add the nearest rung for each holding
        }
      }
    }

    // Sort by percent away (closest first)
    exits.sort((a, b) => a.percentAway - b.percentAway);

    // Return top 5
    return exits.slice(0, 5);
  }, [holdings, prices, exitPlans]);

  const formatPrice = (price: number): string => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    if (tokens >= 1) return tokens.toFixed(2).replace(/\.?0+$/, '');
    return tokens.toFixed(4).replace(/\.?0+$/, '');
  };

  const hasExits = nearestExits.length > 0;

  return (
    <Card className="glass-panel border-divide/80">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold tracking-tight">
            Nearest Exits
          </CardTitle>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {hasExits
            ? 'Your closest upcoming exit targets.'
            : 'No exit plans set yet.'}
        </p>
      </CardHeader>

      <CardContent className="pt-1">
        {hasExits ? (
          <div className="space-y-1.5">
            {nearestExits.map((exit) => (
              <div
                key={`${exit.holdingId}-${exit.rungIndex}`}
                className="flex items-center justify-between rounded-md bg-secondary/40 px-2.5 py-2 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-foreground/90">
                    {exit.symbol}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                  <span className="font-mono text-foreground/80">
                    {formatPrice(exit.targetPrice)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {formatTokens(exit.tokensToSell)} tokens
                  </span>
                  <span
                    className={`font-mono ${
                      exit.percentAway < 10
                        ? 'text-emerald-400'
                        : exit.percentAway < 25
                        ? 'text-amber-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {exit.percentAway.toFixed(1)}% away
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-3 text-center">
            <p className="text-[11px] text-muted-foreground/70">
              Configure exit ladders from the Exit Strategy tab to see your targets here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
