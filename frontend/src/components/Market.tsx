/**
 * Market Tab - Coming Soon Placeholder
 *
 * Original implementation preserved at: Market.tsx.backup
 *
 * Planned features (see HANDOFF.md "Low Priority / Future Work"):
 * - Top Volume Feed: 24h volume-sorted asset list
 * - Screener: Filter by market cap, volume, % change
 * - Watchlists: Save and track favorite assets
 * - Discovery: Trending assets, new listings, momentum signals
 */

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Search, Star, Compass } from 'lucide-react';

interface MarketProps {
  onAddToPortfolio?: (symbol: string) => void;
}

const features = [
  {
    icon: TrendingUp,
    label: 'Top Volume Feed',
    description: '24h volume-sorted assets',
  },
  {
    icon: Search,
    label: 'Screener',
    description: 'Filter by cap, volume, change',
  },
  {
    icon: Star,
    label: 'Watchlists',
    description: 'Track your favorite assets',
  },
  {
    icon: Compass,
    label: 'Discovery',
    description: 'Trending & new listings',
  },
];

export function Market({ onAddToPortfolio: _onAddToPortfolio }: MarketProps) {
  return (
    <div className="space-y-6">
      {/* Centered Coming Soon Content */}
      <div className="flex flex-col items-center justify-center min-h-[60vh] relative">
        {/* Subtle background orb */}
        <div
          className="absolute w-64 h-64 rounded-full opacity-[0.04] blur-3xl pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))',
            animation: 'mesh-drift 18s ease-in-out infinite',
          }}
        />

        <div className="relative z-10 max-w-lg w-full space-y-6">
          {/* Header */}
          <div className="text-center space-y-2 stagger-item">
            <h2 className="text-2xl font-bold font-heading text-foreground tracking-tight">
              Market
            </h2>
            <p className="text-sm text-muted-foreground/70">
              Real-time market intelligence is coming.
            </p>
          </div>

          {/* Feature cards grid */}
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, idx) => (
              <Card
                key={feature.label}
                className="stagger-item glass-panel border-divide-lighter/15 hover:border-divide-lighter/25 transition-smooth group"
                style={{ animationDelay: `${(idx + 1) * 80}ms` }}
              >
                <CardContent className="p-4 text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-gradient-from)]/10 to-[var(--brand-gradient-to)]/10 group-hover:from-[var(--brand-gradient-from)]/20 group-hover:to-[var(--brand-gradient-to)]/20 transition-smooth">
                    <feature.icon className="h-5 w-5 text-foreground/60 group-hover:text-foreground/80 transition-smooth" />
                  </div>
                  <h3 className="text-xs font-semibold font-heading text-foreground/80">
                    {feature.label}
                  </h3>
                  <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Status badge */}
          <div className="text-center stagger-item" style={{ animationDelay: '400ms' }}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/30 border border-divide-lighter/10">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse" />
              <span className="text-[11px] text-muted-foreground/60">
                In Development
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
