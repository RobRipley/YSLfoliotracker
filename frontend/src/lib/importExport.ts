/**
 * Import/Export Module
 * 
 * Handles JSON and CSV import/export functionality
 */

import { type Store, type Holding, type Transaction, type LadderPreset } from './dataModel';

const EXPORT_VERSION = 1;

interface ExportData {
  version: number;
  exportDate: string;
  store: Store;
}

export interface ImportPreview {
  valid: boolean;
  errors: string[];
  warnings: string[];
  changes: {
    holdingsAdded: number;
    holdingsUpdated: number;
    transactionsAdded: number;
    settingsChanged: boolean;
  };
}

interface CSVImportResult {
  valid: Holding[];
  errors: Array<{ row: number; error: string; data: any }>;
}

/**
 * Export complete application state as JSON
 */
export function exportJSON(store: Store): void {
  const data: ExportData = {
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    store,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `crypto-portfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import and validate JSON file
 */
export async function importJSON(file: File): Promise<{ data: ExportData; preview: ImportPreview }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data: ExportData = JSON.parse(content);
        
        // Validate structure
        const errors: string[] = [];
        
        if (!data.version || typeof data.version !== 'number') {
          errors.push('Invalid or missing version number');
        }
        
        if (!data.store || typeof data.store !== 'object') {
          errors.push('Invalid store data structure');
        }
        
        if (!Array.isArray(data.store?.holdings)) {
          errors.push('Invalid holdings data');
        }
        
        if (!Array.isArray(data.store?.transactions)) {
          errors.push('Invalid transactions data');
        }
        
        if (!data.store?.settings) {
          errors.push('Missing settings data');
        }
        
        const preview: ImportPreview = {
          valid: errors.length === 0,
          errors,
          warnings: [],
          changes: {
            holdingsAdded: data.store?.holdings?.length || 0,
            holdingsUpdated: 0,
            transactionsAdded: data.store?.transactions?.length || 0,
            settingsChanged: true,
          },
        };
        
        if (data.version !== EXPORT_VERSION) {
          preview.warnings.push(`Data version mismatch (${data.version} vs ${EXPORT_VERSION}). Migration may be required.`);
        }
        
        resolve({ data, preview });
      } catch (error) {
        reject(new Error('Failed to parse JSON file: ' + (error as Error).message));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Apply imported JSON data to store
 */
export function applyJSONImport(data: ExportData): Store {
  return data.store;
}

/**
 * Export holdings as CSV
 */
export function exportHoldingsCSV(holdings: Holding[], prices: Record<string, number>): void {
  const headers = ['Symbol', 'Tokens Owned', 'Avg Cost', 'Purchase Date', 'Value USD'];
  const rows = holdings.map(h => [
    h.symbol,
    h.tokensOwned.toString(),
    h.avgCost?.toString() || '',
    h.purchaseDate ? new Date(h.purchaseDate).toISOString().split('T')[0] : '',
    (h.tokensOwned * (prices[h.symbol] || 0)).toFixed(2),
  ]);
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  downloadCSV(csv, 'holdings');
}

/**
 * Export transactions as CSV
 */
export function exportTransactionsCSV(transactions: Transaction[]): void {
  const headers = ['Type', 'Symbol', 'Tokens', 'Price USD', 'Total USD', 'Timestamp', 'Notes'];
  const rows = transactions.map(tx => [
    tx.type,
    tx.symbol,
    tx.tokens.toString(),
    tx.priceUsd?.toString() || '',
    tx.totalUsd?.toString() || '',
    new Date(tx.timestamp).toISOString(),
    tx.notes || '',
  ]);
  
  const csv = [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n');
  downloadCSV(csv, 'transactions');
}

/**
 * Export ladder plans as CSV
 */
export function exportLadderPlansCSV(
  holdings: Holding[],
  ladderPresets: { blue: LadderPreset; mid: LadderPreset; low: LadderPreset }
): void {
  const headers = ['Symbol', 'Category', 'Rung', 'Target Price', 'Sell Amount', 'Sell Percent'];
  const rows: string[][] = [];
  
  holdings.forEach(holding => {
    if (!holding.avgCost) return;
    
    // Determine category preset (simplified - would need actual category logic)
    const preset = ladderPresets.mid; // Default to mid for demo
    
    preset.rungs.forEach((rung, index) => {
      rows.push([
        holding.symbol,
        'mid-cap',
        (index + 1).toString(),
        (holding.avgCost! * rung.multiplier).toFixed(2),
        ((holding.tokensOwned * rung.percentOfTotal) / 100).toFixed(4),
        rung.percentOfTotal.toString() + '%',
      ]);
    });
  });
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  downloadCSV(csv, 'ladder-plans');
}

/**
 * Import holdings from CSV
 */
export async function importHoldingsCSV(file: File): Promise<CSVImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          reject(new Error('CSV file is empty or invalid'));
          return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const valid: Holding[] = [];
        const errors: Array<{ row: number; error: string; data: any }> = [];
        
        // Validate headers
        const requiredHeaders = ['symbol', 'tokens owned'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          reject(new Error(`Missing required columns: ${missingHeaders.join(', ')}`));
          return;
        }
        
        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: any = {};
          
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
          });
          
          try {
            // Validate required fields
            if (!row.symbol) {
              throw new Error('Symbol is required');
            }
            
            const tokensOwned = parseFloat(row['tokens owned']);
            if (isNaN(tokensOwned) || tokensOwned <= 0) {
              throw new Error('Invalid tokens owned value');
            }
            
            const holding: Holding = {
              id: `import-${Date.now()}-${i}`,
              symbol: row.symbol.toUpperCase(),
              tokensOwned,
              avgCost: row['avg cost'] ? parseFloat(row['avg cost']) : undefined,
              purchaseDate: row['purchase date'] ? new Date(row['purchase date']).getTime() : Date.now(),
              notes: row.notes || undefined,
            };
            
            // Validate avgCost if provided
            if (holding.avgCost !== undefined && (isNaN(holding.avgCost) || holding.avgCost < 0)) {
              throw new Error('Invalid average cost value');
            }
            
            valid.push(holding);
          } catch (error) {
            errors.push({
              row: i + 1,
              error: (error as Error).message,
              data: row,
            });
          }
        }
        
        resolve({ valid, errors });
      } catch (error) {
        reject(new Error('Failed to parse CSV file: ' + (error as Error).message));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Generate import preview for CSV holdings
 */
export function generateCSVImportPreview(
  currentHoldings: Holding[],
  importedHoldings: Holding[]
): ImportPreview {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for duplicate symbols
  const symbols = new Set<string>();
  const duplicates = new Set<string>();
  
  importedHoldings.forEach(h => {
    if (symbols.has(h.symbol)) {
      duplicates.add(h.symbol);
    }
    symbols.add(h.symbol);
  });
  
  if (duplicates.size > 0) {
    warnings.push(`Duplicate symbols in import: ${Array.from(duplicates).join(', ')}`);
  }
  
  // Check for conflicts with existing holdings
  const existingSymbols = new Set(currentHoldings.map(h => h.symbol));
  const conflicts = importedHoldings.filter(h => existingSymbols.has(h.symbol));
  
  if (conflicts.length > 0) {
    warnings.push(`${conflicts.length} holdings will be merged with existing positions`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    changes: {
      holdingsAdded: importedHoldings.length - conflicts.length,
      holdingsUpdated: conflicts.length,
      transactionsAdded: 0,
      settingsChanged: false,
    },
  };
}

/**
 * Helper: Download CSV file
 */
function downloadCSV(content: string, name: string): void {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `crypto-portfolio-${name}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper: Escape CSV values
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Helper: Parse CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}
