import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Loader2, Search, AlertCircle, Check } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getPriceAggregator } from '@/lib/priceService';
import { store, calculateWeightedAverage, type Holding } from '@/lib/dataModel';
import { 
  searchCoinGecko, 
  getBestCoinGeckoId, 
  SYMBOL_TO_COINGECKO_ID,
  type CoinGeckoSearchResult 
} from '@/lib/coinGeckoSearch';
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
  
  // CoinGecko resolution state
  const [searchResults, setSearchResults] = useState<CoinGeckoSearchResult[]>([]);
  const [selectedCoinGeckoId, setSelectedCoinGeckoId] = useState<string | null>(null);
  const [selectedLogoUrl, setSelectedLogoUrl] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDisambiguation, setShowDisambiguation] = useState(false);
  const [disambiguationNeeded, setDisambiguationNeeded] = useState(false);
  
  // UI state
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingHolding, setExistingHolding] = useState<Holding | null>(null);
  const [priceMode, setPriceMode] = useState<PriceMode>('market');
  
  // Refs for focus management
  const symbolInputRef = useRef<HTMLInputElement>(null);
  const tokensInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  
  // Debounce timer for symbol search
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Search CoinGecko when symbol changes (debounced)
  useEffect(() => {
    if (!symbol || symbol.length < 2) {
      setSearchResults([]);
      setSelectedCoinGeckoId(null);
      setSelectedLogoUrl(null);
      setDisambiguationNeeded(false);
      setShowDisambiguation(false);
      return;
    }

    // Clear previous timer
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    // Check if we have an explicit mapping - no search needed
    const normalizedSymbol = symbol.toUpperCase().trim();
    if (SYMBOL_TO_COINGECKO_ID[normalizedSymbol]) {
      const explicitId = SYMBOL_TO_COINGECKO_ID[normalizedSymbol];
      console.log(`[UnifiedAssetModal] Using explicit CoinGecko ID for ${normalizedSymbol}: ${explicitId}`);
      setSelectedCoinGeckoId(explicitId);
      setDisambiguationNeeded(false);
      setShowDisambiguation(false);
      // Fetch the logo for this coin
      fetchLogoForId(explicitId, normalizedSymbol);
      return;
    }

    // Debounced search
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchCoinGecko(symbol);
        setSearchResults(results);
        
        // Check if disambiguation is needed
        const exactMatches = results.filter(r => r.symbol.toUpperCase() === normalizedSymbol);
        
        if (exactMatches.length > 1) {
          // Multiple exact matches - disambiguation needed
          console.log(`[UnifiedAssetModal] Disambiguation needed for ${normalizedSymbol}: ${exactMatches.length} matches`);
          setDisambiguationNeeded(true);
          setShowDisambiguation(true);
          setSelectedCoinGeckoId(null);
          setSelectedLogoUrl(null);
        } else if (exactMatches.length === 1) {
          // Single exact match - use it
          const match = exactMatches[0];
          console.log(`[UnifiedAssetModal] Single match for ${normalizedSymbol}: ${match.id}`);
          setSelectedCoinGeckoId(match.id);
          setSelectedLogoUrl(match.large || match.thumb || null);
          setDisambiguationNeeded(false);
          setShowDisambiguation(false);
        } else if (results.length > 0) {
          // No exact match - use best result
          const bestId = getBestCoinGeckoId(symbol, results);
          console.log(`[UnifiedAssetModal] No exact match for ${normalizedSymbol}, using best: ${bestId}`);
          setSelectedCoinGeckoId(bestId);
          setSelectedLogoUrl(results[0]?.large || results[0]?.thumb || null);
          setDisambiguationNeeded(false);
          setShowDisambiguation(false);
        } else {
          // No results
          console.log(`[UnifiedAssetModal] No CoinGecko results for ${normalizedSymbol}`);
          setSelectedCoinGeckoId(null);
          setSelectedLogoUrl(null);
          setDisambiguationNeeded(false);
          setShowDisambiguation(false);
        }
      } catch (error) {
        console.error('[UnifiedAssetModal] Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [symbol]);

  // Fetch logo for a specific CoinGecko ID
  const fetchLogoForId = async (coinId: string, symbolForLogging: string) => {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );
      if (response.ok) {
        const data = await response.json();
        const logoUrl = data.image?.large || data.image?.small || data.image?.thumb;
        if (logoUrl) {
          console.log(`[UnifiedAssetModal] Got logo for ${symbolForLogging} (${coinId}): ${logoUrl.substring(0, 50)}...`);
          setSelectedLogoUrl(logoUrl);
        }
      }
    } catch (e) {
      console.warn(`[UnifiedAssetModal] Failed to fetch logo for ${coinId}:`, e);
    }
  };

  // Handle disambiguation selection
  const handleSelectCoin = (coin: CoinGeckoSearchResult) => {
    console.log(`[UnifiedAssetModal] User selected: ${coin.name} (${coin.id})`);
    setSelectedCoinGeckoId(coin.id);
    setSelectedLogoUrl(coin.large || coin.thumb || null);
    setShowDisambiguation(false);
    toast.success(`Selected: ${coin.name}`);
  };

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
        // Use existing CoinGecko ID if available
        if (holding.coingeckoId) {
          setSelectedCoinGeckoId(holding.coingeckoId);
        }
        if (holding.logoUrl) {
          setSelectedLogoUrl(holding.logoUrl);
        }
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

  // Focus symbol input when modal opens
  useEffect(() => {
    if (open) {
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
      setSearchResults([]);
      setSelectedCoinGeckoId(null);
      setSelectedLogoUrl(null);
      setDisambiguationNeeded(false);
      setShowDisambiguation(false);
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
    setSymbol('');
    setTokens('');
    setNotes('');
    setExistingHolding(null);
    setSearchResults([]);
    setSelectedCoinGeckoId(null);
    setSelectedLogoUrl(null);
    setDisambiguationNeeded(false);
    setShowDisambiguation(false);
    
    if (priceMode === 'market') {
      setAvgCost('');
    }
    
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

    // Check if disambiguation is still needed
    if (disambiguationNeeded && !selectedCoinGeckoId) {
      toast.error('Please select which coin you mean');
      setShowDisambiguation(true);
      return { valid: false };
    }

    return { valid: true, tokensOwned };
  };

  // Core submit function
  const submitHolding = useCallback(async (keepOpen: boolean): Promise<boolean> => {
    const validation = validateForm();
    if (!validation.valid || !validation.tokensOwned) {
      return false;
    }

    setIsSubmitting(true);

    try {
      // Create Holding object with CoinGecko ID and logo
      const newHolding: Holding = {
        id: existingHolding?.id || crypto.randomUUID(),
        symbol: symbol.toUpperCase(),
        tokensOwned: validation.tokensOwned,
        avgCost: avgCost ? parseFloat(avgCost) : undefined,
        purchaseDate: date ? new Date(date).getTime() : undefined,
        notes: notes || undefined,
        coingeckoId: selectedCoinGeckoId || undefined,
        logoUrl: selectedLogoUrl || undefined,
      };

      console.log(`[UnifiedAssetModal] Submitting holding:`, {
        symbol: newHolding.symbol,
        coingeckoId: newHolding.coingeckoId,
        logoUrl: newHolding.logoUrl?.substring(0, 50),
      });

      onSubmit(newHolding);

      if (keepOpen) {
        toast.success('Added. Ready for next asset.');
        resetForNextEntry();
      } else {
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
  }, [symbol, tokens, avgCost, date, notes, existingHolding, selectedCoinGeckoId, selectedLogoUrl, onSubmit, onOpenChange, resetForNextEntry, disambiguationNeeded]);

  const handleAddOnce = () => submitHolding(false);
  const handleAddAndAnother = () => submitHolding(true);

  const handleSymbolKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tokensInputRef.current?.focus();
    }
  };

  const handleTokensKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (priceMode === 'manual' && !avgCost) {
        priceInputRef.current?.focus();
      }
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
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

  // Get exact matches for disambiguation display
  const exactMatches = searchResults.filter(r => r.symbol.toUpperCase() === symbol.toUpperCase().trim());

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
          {/* Symbol Input with logo preview */}
          <div>
            <Label htmlFor="unified-symbol">Symbol *</Label>
            <div className="relative">
              <Input
                ref={symbolInputRef}
                id="unified-symbol"
                placeholder="e.g., BTC, ETH, SOL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                onKeyDown={handleSymbolKeyDown}
                className="glass-panel transition-smooth pr-12"
                disabled={isMerging || isSubmitting}
              />
              {/* Logo preview */}
              {selectedLogoUrl && (
                <img 
                  src={selectedLogoUrl} 
                  alt={symbol}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full"
                />
              )}
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* CoinGecko ID indicator */}
            {selectedCoinGeckoId && !showDisambiguation && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-400">
                <Check className="h-3 w-3" />
                <span>Matched: {selectedCoinGeckoId}</span>
              </div>
            )}
            
            {/* Disambiguation needed warning */}
            {disambiguationNeeded && !selectedCoinGeckoId && (
              <button
                type="button"
                onClick={() => setShowDisambiguation(true)}
                className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-400 hover:text-amber-300"
              >
                <AlertCircle className="h-3 w-3" />
                <span>Multiple coins found - click to choose</span>
              </button>
            )}
            
            {isMerging && (
              <p className="text-xs text-muted-foreground mt-1">
                Existing position: {existingHolding.tokensOwned.toLocaleString()} tokens
              </p>
            )}
          </div>

          {/* Disambiguation picker */}
          {showDisambiguation && exactMatches.length > 1 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 mb-2 text-sm text-amber-400">
                <Search className="h-4 w-4" />
                <span>Multiple "{symbol}" coins found. Which do you mean?</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {exactMatches.map((coin) => (
                  <button
                    key={coin.id}
                    type="button"
                    onClick={() => handleSelectCoin(coin)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all ${
                      selectedCoinGeckoId === coin.id
                        ? 'border-primary bg-primary/10'
                        : 'border-divide/50 hover:border-divide hover:bg-white/5'
                    }`}
                  >
                    {coin.thumb || coin.large ? (
                      <img 
                        src={coin.large || coin.thumb} 
                        alt={coin.name}
                        className="h-8 w-8 rounded-full"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                        {coin.symbol.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{coin.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {coin.symbol} • Rank #{coin.market_cap_rank || '?'}
                      </div>
                    </div>
                    {selectedCoinGeckoId === coin.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

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
