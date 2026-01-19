import { memo, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Holding } from '@/lib/dataModel';
import type { ExtendedPriceQuote } from '@/lib/priceService';
import type { ExitPlanState } from '@/lib/exitPlanPersistence';

interface ExitPlanSummaryProps {
  holdings: Holding[];
  prices: Record<string, ExtendedPriceQuote>;
  exitPlans: Record<string, ExitPlanState>;
  selectedPreset: 'n4' | 'custom';
  onPresetChange: (preset: 'n4' | 'custom') => void;
}

export const ExitPlanSummary = memo(function ExitPlanSummary({
  holdings,
  prices,
  exitPlans,
  selectedPreset,
  onPresetChange,
}: ExitPlanSummaryProps) {
  const { plannedHoldings, totalPlannedValue, modeCounts } = useMemo(() => {
    const planned = holdings.filter((h) => exitPlans[h.id]);

    let total = 0;
    const modes: Record<ExitPlanState['mode'], number> = {
      aggressive: 0,
      conservative: 0,
      custom: 0,
    };

    for (const holding of planned) {
      const price =
        prices[holding.symbol.toUpperCase()]?.priceUsd ??
        // fall back to whatever avg cost field exists on the holding
        // (naming may differ slightly between versions)
        // @ts-expect-error - tolerate different shapes
        holding.avgCostUsd ??
        // @ts-expect-error - tolerate different shapes
        holding.avgCost ??
        0;

      // @ts-expect-error - tolerate different shapes
      const tokens: number = holding.tokens ?? holding.tokensOwned ?? 0;

      total += tokens * price;

      const plan = exitPlans[holding.id];
      if (plan) {
        modes[plan.mode] = (modes[plan.mode] || 0) + 1;
      }
    }

    return {
      plannedHoldings: planned,
      totalPlannedValue: total,
      modeCounts: modes,
    };
  }, [holdings, prices, exitPlans]);

  const totalPlanned = plannedHoldings.length;

  const dominantMode =
    totalPlanned === 0
      ? null
      : (Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);

  return (
    <Card className="glass-panel border-divide/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold tracking-tight">
            Exit plan overview
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {totalPlanned === 0
              ? 'No exit ladders configured yet. Use the ladder controls in the table to define a plan.'
              : 'Summary of positions with saved exit ladders.'}
          </p>
        </div>

        <div className="inline-flex rounded-full bg-secondary/70 p-0.5 gap-1">
          <Button
            type="button"
            size="xs"
            variant={selectedPreset === 'n4' ? 'default' : 'outline'}
            onClick={() => onPresetChange('n4')}
            className={[
              'rounded-full px-2.5 py-1 text-[11px] transition-smooth',
              selectedPreset === 'n4'
                ? 'shadow-xs'
                : 'bg-transparent',
            ].join(' ')}
          >
            N/4 ladder
          </Button>
          <Button
            type="button"
            size="xs"
            variant={selectedPreset === 'custom' ? 'default' : 'outline'}
            onClick={() => onPresetChange('custom')}
            className={[
              'rounded-full px-2.5 py-1 text-[11px] transition-smooth',
              selectedPreset === 'custom'
                ? 'shadow-xs'
                : 'bg-transparent',
            ].join(' ')}
          >
            Custom
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Positions planned</div>
            <div className="text-sm font-semibold tabular-nums">
              {totalPlanned}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Planned capital</div>
            <div className="text-sm font-semibold tabular-nums">
              ${totalPlannedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Dominant mode</div>
            <div className="text-sm font-semibold">
              {dominantMode ? dominantMode.charAt(0).toUpperCase() + dominantMode.slice(1) : '—'}
            </div>
          </div>
        </div>

        {totalPlanned > 0 && (
          <div className="space-y-1.5 text-[11px]">
            <div className="text-muted-foreground">Sample planned positions</div>
            <ul className="space-y-0.5">
              {plannedHoldings.slice(0, 3).map((holding) => {
                const plan = exitPlans[holding.id];

                return (
                  <li
                    key={holding.id}
                    className="flex items-center justify-between rounded-md bg-secondary/60 px-2 py-1"
                  >
                    <span className="font-medium text-foreground/90">
                      {holding.symbol.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground">
                      {plan?.mode ? `${plan.mode} ladder` : 'Ladder configured'}
                    </span>
                  </li>
                );
              })}
              {totalPlanned > 3 && (
                <li className="text-muted-foreground">
                  + {totalPlanned - 3} more positions with exit plans
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
});