import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAddHolding } from '@/hooks/useQueries';
import { toast } from 'sonner';

interface AddHoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddHoldingDialog({ open, onOpenChange }: AddHoldingDialogProps) {
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [dollarAmount, setDollarAmount] = useState('');
  const [activeTab, setActiveTab] = useState('quantity');
  
  const addHoldingMutation = useAddHolding();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ticker) {
      toast.error('Please enter a ticker symbol');
      return;
    }

    try {
      let finalQuantity: number;
      let finalPrice: number;

      if (activeTab === 'quantity') {
        if (!quantity || !price) {
          toast.error('Please enter both quantity and price');
          return;
        }
        finalQuantity = parseFloat(quantity);
        finalPrice = parseFloat(price);
      } else {
        if (!dollarAmount) {
          toast.error('Please enter a dollar amount');
          return;
        }
        // In a real app, we'd fetch current price from CoinGecko
        // For now, using a placeholder price
        finalPrice = 50000; // Placeholder BTC price
        finalQuantity = parseFloat(dollarAmount) / finalPrice;
      }

      await addHoldingMutation.mutateAsync({
        symbol: ticker.toUpperCase(),
        tokensOwned: finalQuantity,
        avgCost: finalPrice,
      });

      toast.success('Holding added successfully');
      onOpenChange(false);
      setTicker('');
      setQuantity('');
      setPrice('');
      setDollarAmount('');
    } catch (error) {
      toast.error('Failed to add holding');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Holding</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ticker">Ticker Symbol</Label>
            <Input
              id="ticker"
              placeholder="BTC, ETH, etc."
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="uppercase"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quantity">By Quantity</TabsTrigger>
              <TabsTrigger value="dollar">By Dollar Amount</TabsTrigger>
            </TabsList>
            
            <TabsContent value="quantity" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Purchase Price (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="dollar" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dollarAmount">Dollar Amount</Label>
                <Input
                  id="dollarAmount"
                  type="number"
                  step="any"
                  placeholder="1000.00"
                  value={dollarAmount}
                  onChange={(e) => setDollarAmount(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Quantity will be calculated based on current market price
              </p>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addHoldingMutation.isPending}>
              {addHoldingMutation.isPending ? 'Adding...' : 'Add Holding'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
