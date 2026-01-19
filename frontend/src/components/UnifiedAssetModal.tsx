import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, DollarSign, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getPriceAggregator } from '@/lib/priceService';
import { store, calculateWeightedAverage, type Holding } from '@/lib/dataModel';
import { toast } from 'sonner';

interface UnifiedAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    symbol: string;
    tokens: string;
    avgCost: string;
    date: string;
    notes: string;
    isEdit: boolean;
    existingHolding?: Holding;
  }) => void;
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
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [existingHolding, setExistingHolding] = useState<Holding | null>(null);
  const [priceSource, setPriceSource] = useState<'live' | 'cached' | null>(null);

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
        setShowAdvanced(true);
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
      setShowAdvanced(false);
      setExistingHolding(null);
      setPriceSource(null);
    }
  }, [open]);

  const handleUseCurrentPrice = async () => {
    if (!symbol) {
      toast.error('Please enter a symbol first');
      return;
    }

    setIsFetchingPrice(true);
    setPriceSource(null);
    
    try {
      const aggregator = getPriceAggregator();
      const quotes = await aggregator.getPrice([symbol.toUpperCase()]);
      
      if (quotes.length > 0 && quotes[0].priceUsd > 0) {
        const price = quotes[0].priceUsd;
        const isStale = quotes[0].stale;
        
        setAvgCost(price.toFixed(2));
        setPriceSource(isStale ? 'cached' : 'live');
        
        toast.success(
          isStale 
            ? `Using cached price: $${price.toFixed(2)}` 
            : `Current price: $${price.toFixed(2)}`
        );
        
        if (!showAdvanced) {
          setShowAdvanced(true);
        }
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

    onSubmit({
      symbol,
      tokens,
      avgCost,
      date,
      notes,
      isEdit: !!existingHolding,
      existingHolding: existingHolding || undefined
    });

    // Reset form
    setSymbol('');
    setTokens('');
    setAvgCost('');
    setDate('');
    setNotes('');
    setShowAdvanced(false);
    setExistingHolding(null);
    setPriceSource(null);
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
            <Label htmlFor="unified-symbol">Symbol</Label>
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
              {existingHolding ? 'Additional Tokens' : 'Tokens'}
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

          {/* Use Current Price Button */}
          <button
            type="button"
            onClick={handleUseCurrentPrice}
            disabled={isFetchingPrice || !symbol}
            className="w-full gradient-outline-btn disabled:opacity-50 disabled:cursor-not-allowed transition-smooth"
          >
            <span className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent">
              <DollarSign className="h-4 w-4" />
              {isFetchingPrice ? 'Fetching...' : 'Use Current Market Price'}
            </span>
          </button>

          {priceSource && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={priceSource === 'live' ? 'default' : 'secondary'} className="text-xs">
                {priceSource === 'live' ? 'Live Price' : 'Cached Price'}
              </Badge>
              <span>Price auto-filled below</span>
            </div>
          )}

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start transition-smooth">
                {showAdvanced ? <ChevronDown className="h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                Advanced Options
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div>
                <Label htmlFor="unified-avgCost">Average Cost (USD)</Label>
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
              <div>
                <Label htmlFor="unified-notes">Notes</Label>
                <Textarea
                  id="unified-notes"
                  placeholder="Optional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="glass-panel transition-smooth"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
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
