import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Check, X, ArrowRightLeft, Pencil } from 'lucide-react';
import { useState } from 'react';
import { store, addStablecoin, updateStablecoin, removeStablecoin, updateFreeCash, type Stablecoin } from '@/lib/dataModel';
import { saveStore } from '@/lib/persistence';
import { toast } from 'sonner';

interface CashStablecoinsPanelProps {
  stablecoinPrices: Record<string, number>;
  totalPortfolioValue: number;
}

export function CashStablecoinsPanel({ stablecoinPrices, totalPortfolioValue }: CashStablecoinsPanelProps) {
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState(store.freeCash.toString());
  const [editingStablecoin, setEditingStablecoin] = useState<string | null>(null);
  const [showAddStablecoin, setShowAddStablecoin] = useState(false);
  
  // Add stablecoin form state
  const [newSymbol, setNewSymbol] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');
  
  // Edit stablecoin form state
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const handleSaveCash = () => {
    const amount = parseFloat(cashInput);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    updateFreeCash(amount);
    saveStore(store);
    setIsEditingCash(false);
    toast.success('Free cash updated');
  };

  const handleCancelCash = () => {
    setCashInput(store.freeCash.toString());
    setIsEditingCash(false);
  };

  const handleAddStablecoin = () => {
    if (!newSymbol || !newAmount) {
      toast.error('Please enter symbol and amount');
      return;
    }
    
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    addStablecoin(newSymbol, amount, newNotes);
    saveStore(store);
    
    // Reset form
    setNewSymbol('');
    setNewAmount('');
    setNewNotes('');
    setShowAddStablecoin(false);
    
    toast.success(`Added ${newSymbol.toUpperCase()}`);
  };

  const handleEditStablecoin = (stablecoin: Stablecoin) => {
    setEditingStablecoin(stablecoin.id);
    setEditAmount(stablecoin.amount.toString());
    setEditNotes(stablecoin.notes || '');
  };

  const handleSaveStablecoin = (id: string) => {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    updateStablecoin(id, { amount, notes: editNotes });
    saveStore(store);
    setEditingStablecoin(null);
    toast.success('Stablecoin updated');
  };

  const handleCancelEdit = () => {
    setEditingStablecoin(null);
    setEditAmount('');
    setEditNotes('');
  };

  const handleRemoveStablecoin = (id: string, symbol: string) => {
    if (confirm(`Remove ${symbol}?`)) {
      removeStablecoin(id);
      saveStore(store);
      toast.success(`Removed ${symbol}`);
    }
  };

  const calculateStablecoinValue = (stablecoin: Stablecoin): number => {
    const price = stablecoinPrices[stablecoin.symbol] || 1.0;
    return stablecoin.amount * price;
  };

  const calculateStablecoinShare = (stablecoin: Stablecoin): number => {
    if (totalPortfolioValue === 0) return 0;
    const value = calculateStablecoinValue(stablecoin);
    return (value / totalPortfolioValue) * 100;
  };

  return (
    <Card className="glass-panel border-divide-lighter/30 shadow-minimal">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Cash & Stablecoins</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Free Cash Section - Enhanced styling */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Free cash for investment
          </Label>
          {isEditingCash ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="any"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                className="flex-1 font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCash();
                  if (e.key === 'Escape') handleCancelCash();
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveCash}
                className="h-8 w-8 p-0"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelCash}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg border border-divide-lighter/30 bg-secondary/5">
              <div className="flex items-center gap-3">
                <span className="text-base font-bold font-mono tabular-nums">
                  ${store.freeCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  Not in Total or %
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingCash(true)}
                className="h-7 w-7 p-0 opacity-100"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Stablecoins Section - Enhanced row-card styling */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Stablecoins
          </Label>
          
          {/* Stablecoins Table */}
          {store.stablecoins.length > 0 && (
            <div className="space-y-2">
              {store.stablecoins.map((stablecoin) => (
                <div
                  key={stablecoin.id}
                  className="p-3 rounded-lg border border-divide-lighter/30 bg-secondary/5 space-y-2"
                >
                  {editingStablecoin === stablecoin.id ? (
                    // Edit mode
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold min-w-[60px]">
                          {stablecoin.symbol}
                        </span>
                        <Input
                          type="number"
                          step="any"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="flex-1 h-8"
                          placeholder="Amount"
                        />
                      </div>
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="text-xs resize-none"
                        rows={2}
                        placeholder="Notes (optional)"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveStablecoin(stablecoin.id)}
                          className="h-7 px-2 text-xs"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          className="h-7 px-2 text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode - Compact row-card layout
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Icon + Symbol */}
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-[#10b981]/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[#10b981]">
                            {stablecoin.symbol.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm font-semibold truncate">
                          {stablecoin.symbol}
                        </span>
                      </div>

                      {/* Middle: Value + Tokens */}
                      <div className="flex flex-col items-end flex-1 min-w-0">
                        <span className="text-sm font-bold font-mono tabular-nums">
                          ${calculateStablecoinValue(stablecoin).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          {stablecoin.amount.toLocaleString()} tokens
                        </span>
                      </div>

                      {/* Right: Share % + Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs px-2 py-0.5 font-mono tabular-nums">
                          {calculateStablecoinShare(stablecoin).toFixed(2)}%
                        </Badge>
                        <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditStablecoin(stablecoin)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {}}
                            className="h-6 w-6 p-0"
                            title="Transfer"
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveStablecoin(stablecoin.id, stablecoin.symbol)}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {!editingStablecoin && stablecoin.notes && (
                    <p className="text-xs text-muted-foreground pl-8">
                      {stablecoin.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Stablecoin Form */}
          {showAddStablecoin ? (
            <div className="p-3 rounded-lg border border-divide-lighter/30 space-y-2 bg-secondary/5">
              <Input
                placeholder="Symbol (e.g., USDC)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                className="h-8"
              />
              <Input
                type="number"
                step="any"
                placeholder="Amount"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                className="h-8"
              />
              <Textarea
                placeholder="Notes (optional)"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="text-xs resize-none"
                rows={2}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleAddStablecoin}
                  className="h-7 px-3 text-xs gradient-accent border-0"
                >
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddStablecoin(false);
                    setNewSymbol('');
                    setNewAmount('');
                    setNewNotes('');
                  }}
                  className="h-7 px-3 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddStablecoin(true)}
              className="w-full h-8 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add stablecoin
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
