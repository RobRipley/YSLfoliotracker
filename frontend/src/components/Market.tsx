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

export function Market({ onAddToPortfolio: _onAddToPortfolio }: MarketProps) {
  return (
    <div className="space-y-6">
      {/* Centered Coming Soon Content */}
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Card className="glass-panel border-divide-lighter/20 shadow-minimal max-w-lg w-full">
          <CardContent className="p-8 text-center">
            {/* Icon cluster */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Star className="h-6 w-6 text-primary" />
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Compass className="h-6 w-6 text-primary" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold font-heading text-foreground mb-3">
              Market
            </h2>

            {/* Coming Soon message */}
            <p className="text-muted-foreground text-sm leading-relaxed">
              Coming Soon: Market overview, watchlists, and discovery.
            </p>

            {/* Feature preview list */}
            <div className="mt-6 pt-6 border-t border-divide-lighter/15">
              <p className="text-xs text-muted-foreground/70 uppercase tracking-wider mb-3">
                Planned Features
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 rounded-full bg-secondary/30 text-xs text-muted-foreground">
                  Top Volume Feed
                </span>
                <span className="px-3 py-1 rounded-full bg-secondary/30 text-xs text-muted-foreground">
                  Screener
                </span>
                <span className="px-3 py-1 rounded-full bg-secondary/30 text-xs text-muted-foreground">
                  Watchlists
                </span>
                <span className="px-3 py-1 rounded-full bg-secondary/30 text-xs text-muted-foreground">
                  Discovery
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
