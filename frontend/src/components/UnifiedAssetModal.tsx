import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getPriceAggregator } from '@/lib/priceService';
import { store, calculateWeightedAverage, type Holding } from '@/lib/dataModel';
import { toast } from 'sonner';

interface UnifiedAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (holding: Holding) => void;
  prefilledSymbol?: string;
}

export function UnifiedAssetModal({
  open,
  onOpenChange,
  onSubmit,
  prefilledSymbol
}: UnifiedAssetModalProps) {
  const [symbol, setSymbol] = useState('');
  const [tokens, setTokens] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [date, setDate] = useState(() => {
    // Default to today's date in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [existingHolding, setExistingHolding] = useState<Holding | null>(null);

  // Detect existing holding when symbol changes
  useEffect(() => {
    if (symbol) {
      const holding = store.holdings.find(h => h.symbol === symbol.toUpperCase());
      setExistingHolding(holding || null);
      
      // Pre-fill data if editing existing holding
      if (holding) {
        setTokens(holding.tokensOwned.toString());
        setAvgCost(holding.avgCost?.toString() || '');
        setNotes(holding.notes || '');
      }
    } else {
      setExistingHolding(null);
    }
  }, [symbol]);

  // Handle prefilled symbol
  useEffect(() => {
    if (prefilledSymbol && open) {
      setSymbol(prefilledSymbol);
    }
  }, [prefilledSymbol, open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSymbol('');
      setTokens('');
      setAvgCost('');
      setDate('');
      setNotes('');
      setExistingHolding(null);
    }
  }, [open]);

  const handleUseCurrentPrice = async () => {
    if (!symbol) {
      toast.error('Please enter a symbol first');
      return;
    }

    setIsFetchingPrice(true);
    
    try {
      const aggregator = getPriceAggregator();
      const quotes = await aggregator.getPrice([symbol.toUpperCase()]);
      
      if (quotes.length > 0 && quotes[0].priceUsd > 0) {
        const price = quotes[0].priceUsd;
        setAvgCost(price.toFixed(2));
        toast.success(`Price: $${price.toFixed(2)}`);
      } else {
        toast.error('Could not fetch price for this symbol');
      }
    } catch (error) {
      console.error('[Price Fetch] Error:', error);
      toast.error('Failed to fetch current price');
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleSubmit = () => {
    if (!symbol || !tokens) {
      toast.error('Please enter symbol and tokens');
      return;
    }

    const tokensOwned = parseFloat(tokens);
    if (isNaN(tokensOwned) || tokensOwned <= 0) {
      toast.error('Please enter a valid token amount');
      return;
    }

    // Create Holding object
    const newHolding: Holding = {
      id: existingHolding?.id || crypto.randomUUID(),
      symbol: symbol.toUpperCase(),
      tokensOwned,
      avgCost: avgCost ? parseFloat(avgCost) : undefined,
      purchaseDate: date ? new Date(date).getTime() : undefined,
      notes: notes || undefined,
    };

    onSubmit(newHolding);

    // Reset form
    setSymbol('');
    setTokens('');
    setAvgCost('');
    setDate('');
    setNotes('');
    setExistingHolding(null);
  };

  // Calculate weighted average preview if merging
  const weightedAvgPreview = existingHolding && avgCost && tokens
    ? calculateWeightedAverage(
        existingHolding.avgCost || 0,
        existingHolding.tokensOwned,
        parseFloat(avgCost),
        parseFloat(tokens)
      )
    : null;

  const modalTitle = existingHolding 
    ? `Edit ${existingHolding.symbol}` 
    : 'Add Asset';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-divide/50 shadow-[0_4px_24px_rgba(0,0,0,0.3)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {modalTitle}
            {existingHolding && (
              <Badge variant="secondary" className="text-xs">
                Merging Position
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Symbol Input */}
          <div>
            <Label htmlFor="unified-symbol">Symbol *</Label>
            <Input
              id="unified-symbol"
              placeholder="e.g., BTC, ETH, SOL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="glass-panel transition-smooth"
              disabled={!!existingHolding}
            />
            {existingHolding && (
              <p className="text-xs text-muted-foreground mt-1">
                Existing position: {existingHolding.tokensOwned.toLocaleString()} tokens
              </p>
            )}
          </div>

          {/* Tokens Input */}
          <div>
            <Label htmlFor="unified-tokens">
              {existingHolding ? 'Additional Tokens *' : 'Tokens *'}
            </Label>
            <Input
              id="unified-tokens"
              type="number"
              placeholder="Amount"
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              className="glass-panel transition-smooth"
            />
          </div>

          {/* Token Price with inline "use market" link */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="unified-avgCost">Token Price</Label>
              <button
                type="button"
                onClick={handleUseCurrentPrice}
                disabled={isFetchingPrice || !symbol}
                className="text-xs text-primary underline hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
              >
                {isFetchingPrice ? 'fetching...' : 'use market'}
              </button>
            </div>
            <Input
              id="unified-avgCost"
              type="number"
              placeholder="Optional"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              className="glass-panel transition-smooth"
            />
            {weightedAvgPreview && (
              <div className="mt-2 p-2 rounded-lg bg-accent/10 border border-accent/30">
                <div className="flex items-center gap-2 text-xs">
                  <TrendingUp className="h-3 w-3 text-accent" />
                  <span className="text-muted-foreground">New weighted average:</span>
                  <span className="font-semibold">${weightedAvgPreview.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Purchase Date */}
          <div>
            <Label htmlFor="unified-date">Purchase Date</Label>
            <Input
              id="unified-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="glass-panel transition-smooth"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="unified-notes">Notes</Label>
            <Textarea
              id="unified-notes"
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="glass-panel transition-smooth"
              rows={2}
            />
          </div>

          {/* Required fields note */}
          <p className="text-xs text-muted-foreground">* Required fields</p>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="gradient-outline-btn transition-smooth"
          >
            <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent">
              Cancel
            </span>
          </Button>
          <Button 
            onClick={handleSubmit} 
            className="gradient-outline-btn transition-smooth"
          >
            <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent">
              {existingHolding ? 'Merge Position' : 'Add Asset'}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
