import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { TrendingUp, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getPriceAggregator } from '@/lib/priceService';
import { store, calculateWeightedAverage, type Holding } from '@/lib/dataModel';
import { toast } from 'sonner';

interface UnifiedAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (holding: Holding) => void;
  prefilledSymbol?: string;
}

type PriceMode = 'market' | 'manual';

export function UnifiedAssetModal({
  open,
  onOpenChange,
  onSubmit,
  prefilledSymbol
}: UnifiedAssetModalProps) {
  // Form state
  const [symbol, setSymbol] = useState('');
  const [tokens, setTokens] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  
  // UI state
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingHolding, setExistingHolding] = useState<Holding | null>(null);
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [priceMode, setPriceMode] = useState<PriceMode>('market');
  
  // Refs for focus management
  const symbolInputRef = useRef<HTMLInputElement>(null);
  const tokensInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

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

  // Focus symbol input when modal opens (especially in Quick Add mode)
  useEffect(() => {
    if (open) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        symbolInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSymbol('');
      setTokens('');
      setAvgCost('');
      setDate(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
      });
      setNotes('');
      setExistingHolding(null);
      setPriceMode('market');
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
        setPriceMode('market');
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

  // Reset fields for "Add & Add Another" flow
  const resetForNextEntry = useCallback(() => {
    // Clear per-asset fields
    setSymbol('');
    setTokens('');
    setNotes('');
    setExistingHolding(null);
    
    // Keep: date, priceMode
    // Clear avgCost only if mode is 'market' (will re-fetch for next asset)
    if (priceMode === 'market') {
      setAvgCost('');
    }
    // If manual mode, keep the avgCost value
    
    // Focus symbol input for next entry
    setTimeout(() => {
      symbolInputRef.current?.focus();
    }, 50);
  }, [priceMode]);

  // Shared validation logic
  const validateForm = (): { valid: boolean; tokensOwned?: number } => {
    if (!symbol || !tokens) {
      toast.error('Please enter symbol and tokens');
      return { valid: false };
    }

    const tokensOwned = parseFloat(tokens);
    if (isNaN(tokensOwned) || tokensOwned <= 0) {
      toast.error('Please enter a valid token amount');
      return { valid: false };
    }

    return { valid: true, tokensOwned };
  };

  // Core submit function - reusable for both buttons
  const submitHolding = useCallback(async (keepOpen: boolean): Promise<boolean> => {
    const validation = validateForm();
    if (!validation.valid || !validation.tokensOwned) {
      return false;
    }

    setIsSubmitting(true);

    try {
      // Create Holding object
      const newHolding: Holding = {
        id: existingHolding?.id || crypto.randomUUID(),
        symbol: symbol.toUpperCase(),
        tokensOwned: validation.tokensOwned,
        avgCost: avgCost ? parseFloat(avgCost) : undefined,
        purchaseDate: date ? new Date(date).getTime() : undefined,
        notes: notes || undefined,
      };

      // Call the parent's onSubmit
      onSubmit(newHolding);

      if (keepOpen) {
        // "Add & Add Another" flow
        toast.success('Added. Ready for next asset.');
        resetForNextEntry();
      } else {
        // Standard "Add Asset" flow - close modal
        onOpenChange(false);
      }

      return true;
    } catch (error) {
      console.error('[Submit] Error:', error);
      toast.error('Failed to add asset. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [symbol, tokens, avgCost, date, notes, existingHolding, onSubmit, onOpenChange, resetForNextEntry]);

  // Button handlers
  const handleAddOnce = () => submitHolding(false);
  const handleAddAndAnother = () => submitHolding(true);

  // Keyboard handling for Quick Add mode
  const handleSymbolKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tokensInputRef.current?.focus();
    }
  };

  const handleTokensKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && quickAddMode) {
      e.preventDefault();
      if (priceMode === 'market' || avgCost) {
        // Submit with "Add & Add Another"
        handleAddAndAnother();
      } else if (priceMode === 'manual' && !avgCost) {
        // Focus price input if manual and no price set
        priceInputRef.current?.focus();
      }
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && quickAddMode) {
      e.preventDefault();
      handleAddAndAnother();
    }
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

  const isMerging = !!existingHolding;
  const modalTitle = isMerging ? `Edit ${existingHolding.symbol}` : 'Add Asset';
  const primaryButtonText = isMerging ? 'Merge Position' : 'Add Asset';
  const secondaryButtonText = isMerging ? 'Merge & Add Another' : 'Add & Add Another';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-divide/50 shadow-[0_4px_24px_rgba(0,0,0,0.3)] max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {modalTitle}
              {isMerging && (
                <Badge variant="secondary" className="text-xs">
                  Merging Position
                </Badge>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Quick Add Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-divide/30">
            <div className="flex flex-col">
              <Label htmlFor="quick-add-toggle" className="text-sm font-medium cursor-pointer">
                Quick Add
              </Label>
              <span className="text-[10px] text-muted-foreground">
                Keep modal open and focus Asset for rapid entry
              </span>
            </div>
            <Switch
              id="quick-add-toggle"
              checked={quickAddMode}
              onCheckedChange={setQuickAddMode}
            />
          </div>

          {/* Symbol Input */}
          <div>
            <Label htmlFor="unified-symbol">Symbol *</Label>
            <Input
              ref={symbolInputRef}
              id="unified-symbol"
              placeholder="e.g., BTC, ETH, SOL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={handleSymbolKeyDown}
              className="glass-panel transition-smooth"
              disabled={isMerging || isSubmitting}
            />
            {isMerging && (
              <p className="text-xs text-muted-foreground mt-1">
                Existing position: {existingHolding.tokensOwned.toLocaleString()} tokens
              </p>
            )}
          </div>

          {/* Tokens Input */}
          <div>
            <Label htmlFor="unified-tokens">
              {isMerging ? 'Additional Tokens *' : 'Tokens *'}
            </Label>
            <Input
              ref={tokensInputRef}
              id="unified-tokens"
              type="number"
              placeholder="Amount"
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
              onKeyDown={handleTokensKeyDown}
              className="glass-panel transition-smooth"
              disabled={isSubmitting}
            />
          </div>

          {/* Token Price with inline "use market" link */}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="unified-avgCost">Token Price</Label>
              <button
                type="button"
                onClick={handleUseCurrentPrice}
                disabled={isFetchingPrice || !symbol || isSubmitting}
                className="text-xs text-primary underline hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
              >
                {isFetchingPrice ? 'fetching...' : 'use market'}
              </button>
            </div>
            <Input
              ref={priceInputRef}
              id="unified-avgCost"
              type="number"
              placeholder="Optional"
              value={avgCost}
              onChange={(e) => {
                setAvgCost(e.target.value);
                if (e.target.value) {
                  setPriceMode('manual');
                }
              }}
              onKeyDown={handlePriceKeyDown}
              className="glass-panel transition-smooth"
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
          </div>

          {/* Required fields note */}
          <p className="text-xs text-muted-foreground">* Required fields</p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="gradient-outline-btn transition-smooth"
            disabled={isSubmitting}
          >
            <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent">
              Cancel
            </span>
          </Button>
          
          {/* Add & Add Another button (secondary) */}
          <Button 
            variant="outline"
            onClick={handleAddAndAnother}
            disabled={isSubmitting}
            className="gradient-outline-btn transition-smooth"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent">
                {secondaryButtonText}
              </span>
            )}
          </Button>
          
          {/* Primary Add/Merge button */}
          <Button 
            onClick={handleAddOnce}
            disabled={isSubmitting}
            className="gradient-outline-btn transition-smooth"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent">
                {primaryButtonText}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
