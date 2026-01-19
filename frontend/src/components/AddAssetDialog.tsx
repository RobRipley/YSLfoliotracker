import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign } from 'lucide-react';
import { useState } from 'react';
import { getPriceAggregator } from '@/lib/priceService';
import { toast } from 'sonner';

interface AddAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  tokens: string;
  avgCost: string;
  date: string;
  notes: string;
  onSymbolChange: (value: string) => void;
  onTokensChange: (value: string) => void;
  onAvgCostChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
}

export function AddAssetDialog({
  open,
  onOpenChange,
  symbol,
  tokens,
  avgCost,
  date,
  notes,
  onSymbolChange,
  onTokensChange,
  onAvgCostChange,
  onDateChange,
  onNotesChange,
  onSubmit
}: AddAssetDialogProps) {
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  const handleSubmit = () => {
    onSubmit();
  };

  const handleUseCurrentPrice = async () => {
    if (!symbol) {
      toast.error('Please enter a symbol first');
      return;
    }

    setIsFetchingPrice(true);
    try {
      const aggregator = getPriceAggregator();
      const quotes = await aggregator.getPrice([symbol.toUpperCase()]);
      
      console.log(`[Price Fetch] Symbol: ${symbol}, Quotes:`, quotes);
      
      if (quotes.length > 0 && quotes[0].priceUsd > 0) {
        const price = quotes[0].priceUsd;
        const marketCap = quotes[0].marketCapUsd;
        
        console.log(`[Price Fetch] Success - Price: $${price.toFixed(2)}, Market Cap: $${marketCap?.toLocaleString() || 'N/A'}`);
        
        onAvgCostChange(price.toFixed(2));
        toast.success(`Current price: $${price.toFixed(2)}`);
      } else {
        console.warn(`[Price Fetch] No valid price data for ${symbol}`);
        toast.error('Could not fetch price for this symbol');
      }
    } catch (error) {
      console.error('[Price Fetch] Error:', error);
      toast.error('Failed to fetch current price');
    } finally {
      setIsFetchingPrice(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-divide/50 shadow-[0_4px_24px_rgba(0,0,0,0.3)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent">
            Add Asset
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5 py-4">
          {/* Symbol Input */}
          <div className="space-y-2">
            <Label htmlFor="add-symbol" className="text-sm font-medium text-textPrimary">
              Symbol
            </Label>
            <Input
              id="add-symbol"
              placeholder="e.g., BTC, ETH, SOL"
              value={symbol}
              onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
              className="glass-panel border-divide/30 focus:border-accent/50 transition-colors"
            />
          </div>

          {/* Tokens Input */}
          <div className="space-y-2">
            <Label htmlFor="add-tokens" className="text-sm font-medium text-textPrimary">
              Tokens Owned
            </Label>
            <Input
              id="add-tokens"
              type="number"
              step="any"
              placeholder="Amount"
              value={tokens}
              onChange={(e) => onTokensChange(e.target.value)}
              className="glass-panel border-divide/30 focus:border-accent/50 transition-colors"
            />
          </div>

          {/* Use Current Price Button */}
          <button
            type="button"
            onClick={handleUseCurrentPrice}
            disabled={isFetchingPrice || !symbol}
            className="w-full gradient-outline-btn disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
          >
            <span className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-medium">
              <DollarSign className="h-4 w-4" />
              {isFetchingPrice ? 'Fetching...' : 'Use Current Market Price'}
            </span>
          </button>

          {/* All Fields Visible by Default */}
          <div className="space-y-5 pt-2">
            {/* Average Cost */}
            <div className="space-y-2">
              <Label htmlFor="add-avgCost" className="text-sm font-medium text-textPrimary">
                Average Cost (USD)
              </Label>
              <Input
                id="add-avgCost"
                type="number"
                step="any"
                placeholder="Optional"
                value={avgCost}
                onChange={(e) => onAvgCostChange(e.target.value)}
                className="glass-panel border-divide/30 focus:border-accent/50 transition-colors"
              />
            </div>

            {/* Purchase Date */}
            <div className="space-y-2">
              <Label htmlFor="add-date" className="text-sm font-medium text-textPrimary">
                Purchase Date
              </Label>
              <Input
                id="add-date"
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                className="glass-panel border-divide/30 focus:border-accent/50 transition-colors"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="add-notes" className="text-sm font-medium text-textPrimary">
                Notes
              </Label>
              <Textarea
                id="add-notes"
                placeholder="Optional notes..."
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                className="glass-panel border-divide/30 focus:border-accent/50 transition-colors resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="gradient-outline-btn flex-1"
          >
            <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-medium">
              Cancel
            </span>
          </Button>
          <Button 
            onClick={handleSubmit} 
            className="gradient-outline-btn flex-1"
          >
            <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-medium">
              Add Asset
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
