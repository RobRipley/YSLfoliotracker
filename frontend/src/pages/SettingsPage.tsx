import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Palette, Hash, TrendingUp, Wifi, RotateCcw, AlertTriangle, 
  Download, Upload, FileJson, FileSpreadsheet, Loader2,
  FlaskConical, Library, Settings, ShieldCheck
} from 'lucide-react';
import { DEFAULT_SETTINGS, type Settings as AppSettings, getStore } from '@/lib/dataModel';
import { exportJSON, exportHoldingsCSV, exportTransactionsCSV, exportLadderPlansCSV, importJSON, importHoldingsCSV, generateCSVImportPreview, applyJSONImport, type ImportPreview } from '@/lib/importExport';
import { PREDEFINED_THEMES, loadThemeSettings, saveThemeSettings, applyTheme, getThemePreviewColors, type ThemeSettings } from '@/lib/themes';

// =============================================================================
// ADMIN GATING CONFIGURATION
// =============================================================================
// Set this to true to enable admin features, or wire to real auth later
// Options for real auth:
// 1. Check principal against admin list: principal === 'your-admin-principal-here'
// 2. Environment variable: import.meta.env.VITE_ADMIN_MODE === 'true'
// 3. Backend role check: await actor.is_admin()
// =============================================================================

// For now, use environment variable with fallback to true for development
const IS_ADMIN = import.meta.env.VITE_ADMIN_MODE === 'true' || 
                 import.meta.env.DEV || 
                 true; // Hardcode to true for now - change this when wiring real auth

// =============================================================================

const ADMIN_SETTINGS_KEY = 'crypto-portfolio-admin-settings';

interface AdminSettings {
  numberFormatting: {
    pricePrecision: number;
    tokenPrecision: number;
    defaultCurrency: string;
  };
  categoryThresholds: {
    blueMin: number;
    midMin: number;
    lowMin: number;
  };
  priceProviderSettings: {
    fallbackEnabled: boolean;
    cacheTTL: number;
  };
}

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  numberFormatting: {
    pricePrecision: 2,
    tokenPrecision: 4,
    defaultCurrency: 'USD',
  },
  categoryThresholds: {
    blueMin: DEFAULT_SETTINGS.thresholds.blueChipMin,
    midMin: DEFAULT_SETTINGS.thresholds.midCapMin,
    lowMin: DEFAULT_SETTINGS.thresholds.lowCapMin,
  },
  priceProviderSettings: {
    fallbackEnabled: true,
    cacheTTL: 30,
  },
};

function loadSettings(): AdminSettings {
  try {
    const stored = localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load admin settings:', error);
  }
  return DEFAULT_ADMIN_SETTINGS;
}

function saveSettings(settings: AdminSettings): void {
  try {
    localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save admin settings:', error);
  }
}

// Sub-tab types
type UserSubTab = 'theme' | 'formatting' | 'data';
type AdminSubTab = 'thresholds' | 'providers' | 'tools' | 'strategy-library';
type SubTab = UserSubTab | AdminSubTab;

export function SettingsPage() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('theme');
  const [settings, setSettings] = useState<AdminSettings>(loadSettings);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(loadThemeSettings);
  const [showThresholdPreview, setShowThresholdPreview] = useState(false);
  const [pendingThresholds, setPendingThresholds] = useState(settings.categoryThresholds);
  const [thresholdErrors, setThresholdErrors] = useState<string[]>([]);
  
  // Import/Export state
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const [importType, setImportType] = useState<'json' | 'csv'>('json');
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = IS_ADMIN;

  // Define sub-tabs
  const userTabs: { id: UserSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'theme', label: 'Theme', icon: <Palette className="h-4 w-4" /> },
    { id: 'formatting', label: 'Formatting', icon: <Hash className="h-4 w-4" /> },
    { id: 'data', label: 'Data', icon: <Download className="h-4 w-4" /> },
  ];

  const adminTabs: { id: AdminSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'thresholds', label: 'Thresholds', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'providers', label: 'Providers', icon: <Wifi className="h-4 w-4" /> },
    { id: 'tools', label: 'Tools', icon: <FlaskConical className="h-4 w-4" /> },
    { id: 'strategy-library', label: 'Strategy Library', icon: <Library className="h-4 w-4" /> },
  ];

  // Apply theme on mount and when theme settings change
  useEffect(() => {
    applyTheme(themeSettings.selectedTheme, themeSettings.hueAdjustment);
  }, [themeSettings]);

  // Save settings whenever they change
  useEffect(() => {
    saveSettings(settings);
    window.dispatchEvent(new CustomEvent('adminSettingsChanged', { detail: settings }));
  }, [settings]);

  // Save theme settings whenever they change
  useEffect(() => {
    saveThemeSettings(themeSettings);
  }, [themeSettings]);

  const updateSettings = (partial: Partial<AdminSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  const handleThemeChange = (themeName: string) => {
    setThemeSettings(prev => ({ ...prev, selectedTheme: themeName }));
    toast.success('Theme changed', {
      description: PREDEFINED_THEMES[themeName]?.name || themeName,
    });
  };

  const handleHueChange = (value: number[]) => {
    setThemeSettings(prev => ({ ...prev, hueAdjustment: value[0] }));
  };

  const handlePricePrecisionChange = (value: string) => {
    const precision = parseInt(value, 10);
    if (!isNaN(precision) && precision >= 0 && precision <= 8) {
      updateSettings({
        numberFormatting: {
          ...settings.numberFormatting,
          pricePrecision: precision,
        },
      });
    }
  };

  const handleTokenPrecisionChange = (value: string) => {
    const precision = parseInt(value, 10);
    if (!isNaN(precision) && precision >= 0 && precision <= 8) {
      updateSettings({
        numberFormatting: {
          ...settings.numberFormatting,
          tokenPrecision: precision,
        },
      });
    }
  };

  const validateThresholds = (thresholds: typeof pendingThresholds): string[] => {
    const errors: string[] = [];
    if (thresholds.blueMin <= thresholds.midMin) {
      errors.push('Blue chip minimum must be greater than mid cap minimum');
    }
    if (thresholds.midMin <= thresholds.lowMin) {
      errors.push('Mid cap minimum must be greater than low cap minimum');
    }
    if (thresholds.lowMin <= 0) {
      errors.push('Low cap minimum must be greater than 0');
    }
    return errors;
  };

  const handleThresholdChange = (key: keyof typeof pendingThresholds, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const newThresholds = { ...pendingThresholds, [key]: numValue };
      setPendingThresholds(newThresholds);
      setThresholdErrors(validateThresholds(newThresholds));
    }
  };

  const handleThresholdPreview = () => {
    const errors = validateThresholds(pendingThresholds);
    if (errors.length > 0) {
      toast.error('Invalid thresholds', { description: errors.join('. ') });
      return;
    }
    setShowThresholdPreview(true);
  };

  const handleThresholdConfirm = () => {
    updateSettings({ categoryThresholds: pendingThresholds });
    setShowThresholdPreview(false);
    toast.success('Category thresholds updated', {
      description: 'Assets will be recategorized based on new thresholds',
    });
  };

  const handleResetThresholds = () => {
    const defaults = {
      blueMin: DEFAULT_SETTINGS.thresholds.blueChipMin,
      midMin: DEFAULT_SETTINGS.thresholds.midCapMin,
      lowMin: DEFAULT_SETTINGS.thresholds.lowCapMin,
    };
    setPendingThresholds(defaults);
    updateSettings({ categoryThresholds: defaults });
    setThresholdErrors([]);
    toast.success('Thresholds reset to defaults');
  };

  const handleFallbackToggle = (checked: boolean) => {
    updateSettings({
      priceProviderSettings: {
        ...settings.priceProviderSettings,
        fallbackEnabled: checked,
      },
    });
  };

  const handleCacheTTLChange = (value: string) => {
    const ttl = parseInt(value, 10);
    if (!isNaN(ttl) && ttl >= 10) {
      updateSettings({
        priceProviderSettings: {
          ...settings.priceProviderSettings,
          cacheTTL: ttl,
        },
      });
    }
  };

  // Import/Export handlers
  const handleExportJSON = () => {
    setIsExporting(true);
    try {
      const store = getStore();
      exportJSON(store);
      toast.success('Portfolio exported', { description: 'Complete backup saved as JSON file' });
    } catch (error) {
      toast.error('Export failed', { description: (error as Error).message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportHoldingsCSV = () => {
    setIsExporting(true);
    try {
      const store = getStore();
      const prices: Record<string, number> = {};
      exportHoldingsCSV(store.holdings, prices);
      toast.success('Holdings exported', { description: 'Holdings saved as CSV file' });
    } catch (error) {
      toast.error('Export failed', { description: (error as Error).message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTransactionsCSV = () => {
    setIsExporting(true);
    try {
      const store = getStore();
      exportTransactionsCSV(store.transactions);
      toast.success('Transactions exported', { description: 'Transaction history saved as CSV file' });
    } catch (error) {
      toast.error('Export failed', { description: (error as Error).message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportLadderPlansCSV = () => {
    setIsExporting(true);
    try {
      const store = getStore();
      const legacyPresets = {
        blue: { name: 'Blue Chip Conservative', rungs: [] },
        mid: { name: 'Mid Cap Conservative', rungs: [] },
        low: { name: 'Low Cap Conservative', rungs: [] },
      };
      exportLadderPlansCSV(store.holdings, legacyPresets);
      toast.success('Ladder plans exported', { description: 'Exit strategies saved as CSV file' });
    } catch (error) {
      toast.error('Export failed', { description: (error as Error).message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportJSONClick = () => jsonInputRef.current?.click();
  const handleImportCSVClick = () => csvInputRef.current?.click();

  const handleJSONFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const { data, preview } = await importJSON(file);
      setPendingImportData(data);
      setImportPreview(preview);
      setImportType('json');
      setShowImportPreview(true);
    } catch (error) {
      toast.error('Import failed', { description: (error as Error).message });
    } finally {
      setIsImporting(false);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  };

  const handleCSVFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await importHoldingsCSV(file);
      if (result.errors.length > 0 && result.valid.length === 0) {
        toast.error('Import failed', { description: 'All rows contain errors. Please check the file format.' });
        return;
      }
      const store = getStore();
      const preview = generateCSVImportPreview(store.holdings, result.valid);
      if (result.errors.length > 0) {
        preview.warnings.push(`${result.errors.length} rows skipped due to errors`);
      }
      setPendingImportData(result.valid);
      setImportPreview(preview);
      setImportType('csv');
      setShowImportPreview(true);
    } catch (error) {
      toast.error('Import failed', { description: (error as Error).message });
    } finally {
      setIsImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    try {
      if (importType === 'json') {
        const newStore = applyJSONImport(pendingImportData);
        window.dispatchEvent(new CustomEvent('importStore', { detail: newStore }));
        toast.success('Import successful', { description: 'Portfolio data has been restored' });
      } else {
        window.dispatchEvent(new CustomEvent('importHoldings', { detail: pendingImportData }));
        toast.success('Import successful', { description: `${pendingImportData.length} holdings imported` });
      }
      setShowImportPreview(false);
      setPendingImportData(null);
      setImportPreview(null);
    } catch (error) {
      toast.error('Import failed', { description: (error as Error).message });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.numberFormatting.defaultCurrency,
      minimumFractionDigits: settings.numberFormatting.pricePrecision,
      maximumFractionDigits: settings.numberFormatting.pricePrecision,
    }).format(value);
  };

  const formatTokens = (value: number) => {
    return value.toFixed(settings.numberFormatting.tokenPrecision);
  };

  const currentTheme = PREDEFINED_THEMES[themeSettings.selectedTheme];
  const previewColors = getThemePreviewColors(themeSettings.selectedTheme, themeSettings.hueAdjustment);

  // Render sub-tab content
  const renderContent = () => {
    switch (activeSubTab) {
      case 'theme':
        return <ThemeContent 
          themeSettings={themeSettings}
          handleThemeChange={handleThemeChange}
          handleHueChange={handleHueChange}
          currentTheme={currentTheme}
          previewColors={previewColors}
        />;
      case 'formatting':
        return <FormattingContent
          settings={settings}
          handlePricePrecisionChange={handlePricePrecisionChange}
          handleTokenPrecisionChange={handleTokenPrecisionChange}
          formatCurrency={formatCurrency}
          formatTokens={formatTokens}
        />;
      case 'data':
        return <DataContent
          isExporting={isExporting}
          isImporting={isImporting}
          handleExportJSON={handleExportJSON}
          handleExportHoldingsCSV={handleExportHoldingsCSV}
          handleExportTransactionsCSV={handleExportTransactionsCSV}
          handleExportLadderPlansCSV={handleExportLadderPlansCSV}
          handleImportJSONClick={handleImportJSONClick}
          handleImportCSVClick={handleImportCSVClick}
          jsonInputRef={jsonInputRef}
          csvInputRef={csvInputRef}
          handleJSONFileSelect={handleJSONFileSelect}
          handleCSVFileSelect={handleCSVFileSelect}
        />;
      case 'thresholds':
        return <ThresholdsContent
          settings={settings}
          pendingThresholds={pendingThresholds}
          thresholdErrors={thresholdErrors}
          handleThresholdChange={handleThresholdChange}
          handleThresholdPreview={handleThresholdPreview}
          handleResetThresholds={handleResetThresholds}
        />;
      case 'providers':
        return <ProvidersContent
          settings={settings}
          handleFallbackToggle={handleFallbackToggle}
          handleCacheTTLChange={handleCacheTTLChange}
        />;
      case 'tools':
        return <ToolsContent />;
      case 'strategy-library':
        return <StrategyLibraryContent />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Customize application settings and preferences</p>
      </div>

      {/* Two-level navigation */}
      <div className="flex flex-col gap-4">
        {/* Main section pills */}
        <div className="flex gap-2 border-b border-border/30 pb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/10 text-sm font-medium">
            <Settings className="h-4 w-4" />
            Settings
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 text-sm font-medium">
              <ShieldCheck className="h-4 w-4" />
              Admin
            </div>
          )}
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap gap-1">
          {/* User tabs */}
          {userTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-smooth ${
                activeSubTab === tab.id
                  ? 'text-foreground bg-secondary/12 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/6'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}

          {/* Divider */}
          {isAdmin && (
            <div className="w-px h-6 bg-border/30 mx-2 self-center" />
          )}

          {/* Admin tabs (only visible to admins) */}
          {isAdmin && adminTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-smooth ${
                activeSubTab === tab.id
                  ? 'text-amber-500 bg-amber-500/12 shadow-xs'
                  : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-500/6'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mt-4">
        {renderContent()}
      </div>

      {/* Threshold Preview Dialog */}
      <AlertDialog open={showThresholdPreview} onOpenChange={setShowThresholdPreview}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Threshold Changes</AlertDialogTitle>
            <AlertDialogDescription>
              The following threshold changes will be applied. This may cause assets to be recategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium mb-2">Current</p>
                <div className="space-y-1 text-muted-foreground">
                  <p>Blue: ${(settings.categoryThresholds.blueMin / 1e9).toFixed(1)}B</p>
                  <p>Mid: ${(settings.categoryThresholds.midMin / 1e6).toFixed(0)}M</p>
                  <p>Low: ${(settings.categoryThresholds.lowMin / 1e6).toFixed(0)}M</p>
                </div>
              </div>
              <div>
                <p className="font-medium mb-2">New</p>
                <div className="space-y-1">
                  <p>Blue: ${(pendingThresholds.blueMin / 1e9).toFixed(1)}B</p>
                  <p>Mid: ${(pendingThresholds.midMin / 1e6).toFixed(0)}M</p>
                  <p>Low: ${(pendingThresholds.lowMin / 1e6).toFixed(0)}M</p>
                </div>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleThresholdConfirm}>Apply Changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Preview Dialog */}
      <Dialog open={showImportPreview} onOpenChange={setShowImportPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>Review the changes before importing data</DialogDescription>
          </DialogHeader>
          {importPreview && (
            <ScrollArea className="max-h-96">
              <div className="space-y-4">
                {importPreview.errors.length > 0 && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium text-destructive">Errors</p>
                        {importPreview.errors.map((error, i) => (
                          <p key={i} className="text-sm text-destructive">{error}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {importPreview.warnings.length > 0 && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium text-yellow-600 dark:text-yellow-500">Warnings</p>
                        {importPreview.warnings.map((warning, i) => (
                          <p key={i} className="text-sm text-yellow-600 dark:text-yellow-500">{warning}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="font-medium">Changes Summary</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 rounded border glass-panel">
                      <p className="text-muted-foreground">Holdings Added</p>
                      <p className="text-lg font-semibold">{importPreview.changes.holdingsAdded}</p>
                    </div>
                    <div className="p-2 rounded border glass-panel">
                      <p className="text-muted-foreground">Holdings Updated</p>
                      <p className="text-lg font-semibold">{importPreview.changes.holdingsUpdated}</p>
                    </div>
                    <div className="p-2 rounded border glass-panel">
                      <p className="text-muted-foreground">Transactions Added</p>
                      <p className="text-lg font-semibold">{importPreview.changes.transactionsAdded}</p>
                    </div>
                    <div className="p-2 rounded border glass-panel">
                      <p className="text-muted-foreground">Settings Changed</p>
                      <p className="text-lg font-semibold">{importPreview.changes.settingsChanged ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportPreview(false)}>Cancel</Button>
            <Button onClick={handleConfirmImport} disabled={!importPreview?.valid}>
              <Upload className="h-4 w-4 mr-2" />
              Confirm Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// =============================================================================
// Sub-components for each settings section
// =============================================================================

interface ThemeContentProps {
  themeSettings: ThemeSettings;
  handleThemeChange: (theme: string) => void;
  handleHueChange: (value: number[]) => void;
  currentTheme: typeof PREDEFINED_THEMES[string] | undefined;
  previewColors: { primary: string; secondary: string; background: string };
}

function ThemeContent({ themeSettings, handleThemeChange, handleHueChange, currentTheme, previewColors }: ThemeContentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme Selector</CardTitle>
        <CardDescription>Choose from predefined themes and customize accent colors</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Theme</Label>
            <Select value={themeSettings.selectedTheme} onValueChange={handleThemeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PREDEFINED_THEMES).map(([key, theme]) => (
                  <SelectItem key={key} value={key}>{theme.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentTheme && (
              <p className="text-sm text-muted-foreground">{currentTheme.description}</p>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Theme Preview Cards</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(PREDEFINED_THEMES).map(([key, theme]) => {
                const colors = getThemePreviewColors(key, themeSettings.hueAdjustment);
                const isSelected = themeSettings.selectedTheme === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleThemeChange(key)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      isSelected ? 'border-primary shadow-glow' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex gap-1 h-8">
                        <div className="flex-1 rounded" style={{ backgroundColor: colors.primary }} />
                        <div className="flex-1 rounded" style={{ backgroundColor: colors.secondary }} />
                      </div>
                      <div className="h-6 rounded" style={{ backgroundColor: colors.background }} />
                      <p className="text-xs font-medium truncate">{theme.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Hue Adjustment</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[themeSettings.hueAdjustment]}
                onValueChange={handleHueChange}
                min={-180}
                max={180}
                step={1}
                className="flex-1"
              />
              <span className="text-sm font-mono w-16 text-right">
                {themeSettings.hueAdjustment > 0 ? '+' : ''}{themeSettings.hueAdjustment}°
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Shift the hue of accent colors to customize the theme</p>
            <div className="flex gap-2 mt-2">
              <div className="h-12 flex-1 rounded border" style={{ backgroundColor: previewColors.primary }} />
              <div className="h-12 flex-1 rounded border" style={{ backgroundColor: previewColors.secondary }} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Live Preview</Label>
            <div className="space-y-2 p-4 rounded-lg border glass-panel">
              <h3 className="text-xl font-bold">Heading Example</h3>
              <p className="text-base">This is regular paragraph text with the selected theme.</p>
              <p className="text-sm text-muted-foreground">This is smaller muted text.</p>
              <div className="flex gap-2 mt-4">
                <button className="gradient-outline-btn text-sm">
                  <span className="bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-violet)] bg-clip-text text-transparent">
                    Primary Button
                  </span>
                </button>
                <Button size="sm" variant="secondary">Secondary</Button>
                <Button size="sm" variant="outline">Outline</Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface FormattingContentProps {
  settings: AdminSettings;
  handlePricePrecisionChange: (value: string) => void;
  handleTokenPrecisionChange: (value: string) => void;
  formatCurrency: (value: number) => string;
  formatTokens: (value: number) => string;
}

function FormattingContent({ settings, handlePricePrecisionChange, handleTokenPrecisionChange, formatCurrency, formatTokens }: FormattingContentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Number Formatting</CardTitle>
        <CardDescription>Configure decimal precision and currency display</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Price Decimal Precision</Label>
            <Select value={settings.numberFormatting.pricePrecision.toString()} onValueChange={handlePricePrecisionChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} decimal places</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Token Decimal Precision</Label>
            <Select value={settings.numberFormatting.tokenPrecision.toString()} onValueChange={handleTokenPrecisionChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n} decimal places</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Default Currency</Label>
          <Select value={settings.numberFormatting.defaultCurrency} disabled>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="USD">USD ($)</SelectItem></SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Additional currencies will be available in future updates</p>
        </div>
        <Separator />
        <div className="space-y-3">
          <Label>Live Preview</Label>
          <div className="p-4 rounded-lg border glass-panel space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price Example:</span>
              <span className="font-mono">{formatCurrency(1234.56789)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Token Example:</span>
              <span className="font-mono">{formatTokens(123.456789)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Small Price:</span>
              <span className="font-mono">{formatCurrency(0.00123456)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


interface DataContentProps {
  isExporting: boolean;
  isImporting: boolean;
  handleExportJSON: () => void;
  handleExportHoldingsCSV: () => void;
  handleExportTransactionsCSV: () => void;
  handleExportLadderPlansCSV: () => void;
  handleImportJSONClick: () => void;
  handleImportCSVClick: () => void;
  jsonInputRef: React.RefObject<HTMLInputElement>;
  csvInputRef: React.RefObject<HTMLInputElement>;
  handleJSONFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCSVFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function DataContent({
  isExporting, isImporting, handleExportJSON, handleExportHoldingsCSV,
  handleExportTransactionsCSV, handleExportLadderPlansCSV,
  handleImportJSONClick, handleImportCSVClick,
  jsonInputRef, csvInputRef, handleJSONFileSelect, handleCSVFileSelect
}: DataContentProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
          <CardDescription>Upload portfolio data from backup files</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="h-24 flex-col gap-2" onClick={handleImportJSONClick} disabled={isImporting}>
              {isImporting ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                <>
                  <FileJson className="h-6 w-6" />
                  <span>Import JSON</span>
                  <span className="text-xs text-muted-foreground">Complete backup</span>
                </>
              )}
            </Button>
            <Button variant="outline" className="h-24 flex-col gap-2" onClick={handleImportCSVClick} disabled={isImporting}>
              {isImporting ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                <>
                  <FileSpreadsheet className="h-6 w-6" />
                  <span>Import Holdings CSV</span>
                  <span className="text-xs text-muted-foreground">Holdings only</span>
                </>
              )}
            </Button>
          </div>
          <input ref={jsonInputRef} type="file" accept=".json" className="hidden" onChange={handleJSONFileSelect} />
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFileSelect} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>Download portfolio data for backup or analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleExportJSON} disabled={isExporting}>
              <FileJson className="h-5 w-5" /><span>Export JSON</span>
              <span className="text-xs text-muted-foreground">Complete backup</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleExportHoldingsCSV} disabled={isExporting}>
              <FileSpreadsheet className="h-5 w-5" /><span>Export Holdings CSV</span>
              <span className="text-xs text-muted-foreground">Current positions</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleExportTransactionsCSV} disabled={isExporting}>
              <FileSpreadsheet className="h-5 w-5" /><span>Export Transactions CSV</span>
              <span className="text-xs text-muted-foreground">History</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={handleExportLadderPlansCSV} disabled={isExporting}>
              <FileSpreadsheet className="h-5 w-5" /><span>Export Ladder Plans CSV</span>
              <span className="text-xs text-muted-foreground">Exit strategies</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ThresholdsContentProps {
  settings: AdminSettings;
  pendingThresholds: { blueMin: number; midMin: number; lowMin: number };
  thresholdErrors: string[];
  handleThresholdChange: (key: 'blueMin' | 'midMin' | 'lowMin', value: string) => void;
  handleThresholdPreview: () => void;
  handleResetThresholds: () => void;
}

function ThresholdsContent({ settings, pendingThresholds, thresholdErrors, handleThresholdChange, handleThresholdPreview, handleResetThresholds }: ThresholdsContentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Thresholds</CardTitle>
        <CardDescription>Define market cap boundaries for asset categorization</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Blue Chip Minimum (Market Cap)</Label>
            <Input type="number" value={pendingThresholds.blueMin} onChange={(e) => handleThresholdChange('blueMin', e.target.value)} placeholder="10000000000" />
            <p className="text-xs text-muted-foreground">Current: ${(pendingThresholds.blueMin / 1e9).toFixed(1)}B</p>
          </div>
          <div className="space-y-2">
            <Label>Mid Cap Minimum (Market Cap)</Label>
            <Input type="number" value={pendingThresholds.midMin} onChange={(e) => handleThresholdChange('midMin', e.target.value)} placeholder="500000000" />
            <p className="text-xs text-muted-foreground">Current: ${(pendingThresholds.midMin / 1e6).toFixed(0)}M</p>
          </div>
          <div className="space-y-2">
            <Label>Low Cap Minimum (Market Cap)</Label>
            <Input type="number" value={pendingThresholds.lowMin} onChange={(e) => handleThresholdChange('lowMin', e.target.value)} placeholder="10000000" />
            <p className="text-xs text-muted-foreground">Current: ${(pendingThresholds.lowMin / 1e6).toFixed(0)}M</p>
          </div>
        </div>
        {thresholdErrors.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="space-y-1">
                {thresholdErrors.map((error, i) => (
                  <p key={i} className="text-sm text-destructive">{error}</p>
                ))}
              </div>
            </div>
          </div>
        )}
        <Separator />
        <div className="flex gap-2">
          <Button onClick={handleThresholdPreview} disabled={thresholdErrors.length > 0}>Preview Changes</Button>
          <Button variant="outline" onClick={handleResetThresholds}>
            <RotateCcw className="h-4 w-4 mr-2" />Reset to Defaults
          </Button>
        </div>
        <Separator />
        <div className="space-y-3">
          <Label>Current Definitions</Label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default">Blue Chip</Badge>
              <span className="text-sm text-muted-foreground">≥ ${(settings.categoryThresholds.blueMin / 1e9).toFixed(1)}B</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Mid Cap</Badge>
              <span className="text-sm text-muted-foreground">${(settings.categoryThresholds.midMin / 1e6).toFixed(0)}M - ${(settings.categoryThresholds.blueMin / 1e9).toFixed(1)}B</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Low Cap</Badge>
              <span className="text-sm text-muted-foreground">${(settings.categoryThresholds.lowMin / 1e6).toFixed(0)}M - ${(settings.categoryThresholds.midMin / 1e6).toFixed(0)}M</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


interface ProvidersContentProps {
  settings: AdminSettings;
  handleFallbackToggle: (checked: boolean) => void;
  handleCacheTTLChange: (value: string) => void;
}

function ProvidersContent({ settings, handleFallbackToggle, handleCacheTTLChange }: ProvidersContentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Provider Settings</CardTitle>
        <CardDescription>Configure price data sources and caching behavior</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Fallback Provider</Label>
            <p className="text-sm text-muted-foreground">Use CryptoRates.ai as backup when CoinGecko fails</p>
          </div>
          <Switch checked={settings.priceProviderSettings.fallbackEnabled} onCheckedChange={handleFallbackToggle} />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label>Cache TTL (seconds)</Label>
          <Input type="number" value={settings.priceProviderSettings.cacheTTL} onChange={(e) => handleCacheTTLChange(e.target.value)} min="10" step="5" />
          <p className="text-xs text-muted-foreground">Minimum: 10 seconds. Price data will be cached for this duration.</p>
        </div>
        <Separator />
        <div className="space-y-3">
          <Label>Provider Status</Label>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg border glass-panel">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="font-medium">CoinGecko (Primary)</span>
              </div>
              <Badge variant="outline">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border glass-panel">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${settings.priceProviderSettings.fallbackEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="font-medium">CryptoRates.ai (Fallback)</span>
              </div>
              <Badge variant={settings.priceProviderSettings.fallbackEnabled ? 'outline' : 'secondary'}>
                {settings.priceProviderSettings.fallbackEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Tools Content - moved from DataModelTest page (admin-only)
function ToolsContent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Developer Tools</CardTitle>
        <CardDescription>Debug utilities and data model testing (admin-only)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <FlaskConical className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-amber-500">Admin Tools</p>
              <p className="text-sm text-muted-foreground mt-1">
                This section contains developer/debugging tools that were previously in the Test tab.
                These tools allow testing of the data model, viewing store state, and running diagnostics.
              </p>
            </div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>Available tools:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Data model helper function tests</li>
            <li>Sample data generator</li>
            <li>Live store state viewer (holdings, transactions, settings)</li>
            <li>Category assignment diagnostics</li>
          </ul>
        </div>
        <Button variant="outline" className="w-full" onClick={() => window.dispatchEvent(new CustomEvent('openTestPanel'))}>
          Open Full Test Panel
        </Button>
      </CardContent>
    </Card>
  );
}

// Strategy Library Content - UI placeholder (admin-only)
function StrategyLibraryContent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategy Library</CardTitle>
        <CardDescription>Manage and share exit strategy presets (coming soon)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <Library className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Feature Preview</p>
              <p className="text-sm text-muted-foreground mt-1">
                The Strategy Library will allow you to create, save, and share exit strategy templates
                across your portfolio. This feature is currently under development.
              </p>
            </div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>Planned features:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Create custom ladder presets with named templates</li>
            <li>Apply presets to multiple assets at once</li>
            <li>Export/import strategy configurations</li>
            <li>Community-shared strategy templates</li>
          </ul>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled className="flex-1">
            <Upload className="h-4 w-4 mr-2" />Import Strategies
          </Button>
          <Button variant="outline" disabled className="flex-1">
            <Download className="h-4 w-4 mr-2" />Export Strategies
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Keep AdminPanel export for backward compatibility
export { SettingsPage as AdminPanel };
