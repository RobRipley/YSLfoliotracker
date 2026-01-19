import { useEffect } from 'react';
import { PortfolioDashboard } from './PortfolioDashboard';
import { getPriceAggregator } from '@/lib/priceService';

interface PortfolioProps {
  prefilledSymbol?: string;
  onSymbolUsed?: () => void;
}

export function Portfolio({ prefilledSymbol, onSymbolUsed }: PortfolioProps) {
  useEffect(() => {
    // Initialize price service in mock mode
    getPriceAggregator();
  }, []);

  return (
    <div className="space-y-6">
      <PortfolioDashboard 
        onOpenSidebar={() => {}} // No-op function since sidebar is not used
        prefilledSymbol={prefilledSymbol}
        onSymbolUsed={onSymbolUsed}
      />
    </div>
  );
}
