import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getPriceAggregator } from '@/lib/priceService';
import { store, recordTransaction, type TransactionType } from '@/lib/dataModel';
import { saveStore } from '@/lib/persistence';
import { toast } from 'sonner';

type TransactionMode = 'buy' | 'sell' | 'transfer-in' | 'transfer-out';

interface AssetTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledSymbol?: string;
  onSuccess?: () => void;
}

export function AssetTransactionModal({
  open,
  onOpenChange,
  prefilledSymbol,
  onSuccess
}: AssetTransactionModalProps) {
  const [mode, setMode] = useState<TransactionMode>('buy');
  const [symbol, setSymbol] = useState('');
  const [tokens, setTokens] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const symbolInputRef = useRef<HTMLInputElement>(null);

  // Handle prefilled symbol
  useEffect(() => {
    if (prefilledSymbol && open) {
      setSymbol(prefilledSymbol);
      setMode('buy');
    }
  }, [prefilledSymbol, open]);

  // Auto-focus symbol input when modal opens
  useEffect(() => {
    if (open && !prefilledSymbol) {
      setTimeout(() => {
        symbolInputRef.current?.focus();
      }, 100);
    }
  }, [open, prefilledSymbol]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setMode('buy');
      setSymbol('');
      setTokens('');
      setPrice('');
      setDate('');
      setNotes('');
    }
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    if (open) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [open, onOpenChange]);

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
        const currentPrice = quotes[0].priceUsd;
        const isStale = quotes[0].stale;
        
        setPrice(currentPrice.toFixed(2));
        
        toast.success(
          isStale 
            ? `Using cached price: $${currentPrice.toFixed(2)}` 
            : `Current price: $${currentPrice.toFixed(2)}`
        );
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

    const tokensNum = parseFloat(tokens);
    const priceNum = price ? parseFloat(price) : undefined;

    // Validate sell amount
    if (mode === 'sell' || mode === 'transfer-out') {
      const holding = store.holdings.find(h => h.symbol === symbol.toUpperCase());
      if (!holding) {
        toast.error(`You don't own any ${symbol.toUpperCase()}`);
        return;
      }
      if (tokensNum > holding.tokensOwned) {
        toast.error(`Cannot ${mode === 'sell' ? 'sell' : 'transfer out'} more than you own (${holding.tokensOwned.toLocaleString()} tokens)`);
        return;
      }
    }

    try {
      // Record transaction
      const transaction = recordTransaction({
        type: mode as TransactionType,
        symbol: symbol.toUpperCase(),
        tokens: tokensNum,
        priceUsd: priceNum,
        totalUsd: priceNum ? tokensNum * priceNum : undefined,
        timestamp: date ? new Date(date).getTime() : Date.now(),
        notes: notes || undefined
      });

      // Persist changes immediately
      saveStore(store);

      // Show success message with preview
      let message = '';
      switch (mode) {
        case 'buy':
          message = `Bought ${tokensNum.toLocaleString()} ${symbol.toUpperCase()}`;
          if (priceNum) message += ` at $${priceNum.toFixed(2)}`;
          break;
        case 'sell':
          const proceeds = priceNum ? tokensNum * priceNum : 0;
          message = `Sold ${tokensNum.toLocaleString()} ${symbol.toUpperCase()}`;
          if (proceeds > 0) message += ` for $${proceeds.toLocaleString()}`;
          break;
        case 'transfer-in':
          message = `Transferred in ${tokensNum.toLocaleString()} ${symbol.toUpperCase()}`;
          break;
        case 'transfer-out':
          message = `Transferred out ${tokensNum.toLocaleString()} ${symbol.toUpperCase()}`;
          break;
      }

      toast.success(message);
      
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('[Transaction] Error:', error);
      toast.error('Failed to process transaction');
    }
  };

  // Handle Enter key for form submission
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Calculate preview for sell mode
  const sellPreview = mode === 'sell' && tokens && price ? {
    proceeds: parseFloat(tokens) * parseFloat(price),
    remaining: (() => {
      const holding = store.holdings.find(h => h.symbol === symbol.toUpperCase());
      return holding ? holding.tokensOwned - parseFloat(tokens) : 0;
    })()
  } : null;

  // Get action button label
  const getActionLabel = () => {
    switch (mode) {
      case 'buy': return 'Buy';
      case 'sell': return 'Sell';
      case 'transfer-in': return 'Transfer In';
      case 'transfer-out': return 'Transfer Out';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-md bg-[hsl(var(--bg2))] border border-[hsl(var(--divide))]/30 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.65)] backdrop-blur-sm"
        style={{
          backdropFilter: 'blur(12px)',
        }}
        onKeyDown={handleKeyDown}
      >
        <div 
          className="absolute inset-0 bg-black/40 -z-10 rounded-xl"
          onClick={() => onOpenChange(false)}
        />
        
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-[hsl(var(--textPrimary))]">
            Asset Transaction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Segmented Control for Mode Selection - Solid opaque tabs with clear selected state */}
          <div 
            className="inline-flex rounded-lg p-1 w-full bg-[hsl(var(--bg1))] border border-[hsl(var(--divide))]/30"
          >
            {(['buy', 'sell', 'transfer-in', 'transfer-out'] as TransactionMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/30"
                style={{
                  backgroundColor: mode === m ? 'hsl(var(--bg2))' : 'transparent',
                  color: mode === m ? 'hsl(var(--textPrimary))' : 'hsl(var(--textMuted))',
                  fontWeight: mode === m ? 600 : 500,
                  border: mode === m ? '1px solid hsl(var(--divide))/40' : 'none',
                  boxShadow: mode === m ? '0 2px 4px rgba(0,0,0,0.15)' : 'none'
                }}
              >
                {m === 'transfer-in' ? 'Transfer In' : m === 'transfer-out' ? 'Transfer Out' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Symbol Input - Visible border and light background */}
          <div className="space-y-2">
            <Label htmlFor="tx-symbol" className="text-sm font-medium text-[hsl(var(--textPrimary))]">
              Symbol
            </Label>
            <Input
              ref={symbolInputRef}
              id="tx-symbol"
              placeholder="e.g., BTC, ETH, SOL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="bg-[hsl(var(--bg1))] border border-[hsl(var(--divide))]/40 text-[hsl(var(--textPrimary))] focus:ring-2 focus:ring-[hsl(var(--accent))]/30 focus:border-[hsl(var(--accent))]/50 transition-all duration-150"
            />
          </div>

          {/* Tokens Input - Visible border and light background */}
          <div className="space-y-2">
            <Label htmlFor="tx-tokens" className="text-sm font-medium text-[hsl(var(--textPrimary))]">
              Tokens
            </Label>
            <Input
              id="tx-tokens"
              type="number"
              step="any"
              placeholder="Amount"
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              className="bg-[hsl(var(--bg1))] border border-[hsl(var(--divide))]/40 text-[hsl(var(--textPrimary))] focus:ring-2 focus:ring-[hsl(var(--accent))]/30 focus:border-[hsl(var(--accent))]/50 transition-all duration-150"
            />
          </div>

          {/* Price Input with Use Current Market Price Button - Visible border and light background */}
          <div className="space-y-2">
            <Label htmlFor="tx-price" className="text-sm font-medium text-[hsl(var(--textPrimary))]">
              Price (USD)
            </Label>
            <div className="space-y-2">
              <Input
                id="tx-price"
                type="number"
                step="any"
                placeholder="Price per token"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-[hsl(var(--bg1))] border border-[hsl(var(--divide))]/40 text-[hsl(var(--textPrimary))] focus:ring-2 focus:ring-[hsl(var(--accent))]/30 focus:border-[hsl(var(--accent))]/50 transition-all duration-150"
              />
              {/* Styled accent button for "Use Current Market Price" */}
              <Button
                type="button"
                onClick={handleUseCurrentPrice}
                disabled={isFetchingPrice || !symbol}
                className="w-full bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] text-white font-semibold hover:shadow-[0_0_16px_rgba(6,182,212,0.4)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed border-0"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                {isFetchingPrice ? 'Fetching...' : 'Use Current Market Price'}
              </Button>
            </div>
          </div>

          {/* Date Input - Visible border and light background */}
          <div className="space-y-2">
            <Label htmlFor="tx-date" className="text-sm font-medium text-[hsl(var(--textPrimary))]">
              Date
            </Label>
            <Input
              id="tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-[hsl(var(--bg1))] border border-[hsl(var(--divide))]/40 text-[hsl(var(--textPrimary))] focus:ring-2 focus:ring-[hsl(var(--accent))]/30 focus:border-[hsl(var(--accent))]/50 transition-all duration-150"
            />
          </div>

          {/* Notes Input - Visible border and light background */}
          <div className="space-y-2">
            <Label htmlFor="tx-notes" className="text-sm font-medium text-[hsl(var(--textPrimary))]">
              Notes
            </Label>
            <Textarea
              id="tx-notes"
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-[hsl(var(--bg1))] border border-[hsl(var(--divide))]/40 text-[hsl(var(--textPrimary))] resize-none focus:ring-2 focus:ring-[hsl(var(--accent))]/30 focus:border-[hsl(var(--accent))]/50 transition-all duration-150"
            />
          </div>

          {/* Sell Preview */}
          {sellPreview && (
            <div 
              className="space-y-1 p-3 rounded-lg text-sm bg-[rgba(6,182,212,0.10)] border border-[rgba(6,182,212,0.30)]"
            >
              <div className="flex justify-between">
                <span className="text-[hsl(var(--textMuted))]">Est. Proceeds:</span>
                <span className="font-semibold text-[hsl(var(--textPrimary))]">
                  ${sellPreview.proceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(var(--textMuted))]">Remaining Position:</span>
                <span className="font-semibold text-[hsl(var(--textPrimary))]">
                  {sellPreview.remaining.toLocaleString()} tokens
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-transparent border-[hsl(var(--divide))]/40 text-[hsl(var(--textPrimary))] hover:bg-secondary/10 transition-all duration-150"
          >
            Cancel
          </Button>
          {/* Primary action button with gradient styling */}
          <Button 
            onClick={handleSubmit}
            className="flex-1 bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] text-white font-semibold hover:shadow-[0_0_16px_rgba(6,182,212,0.4)] transition-all duration-150 border-0"
          >
            {getActionLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
