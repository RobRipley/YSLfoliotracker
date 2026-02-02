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
import { DEFAULT_SETTINGS, type Settings as AppSettings, getStore, categorize } from '@/lib/dataModel';
import { exportJSON, exportHoldingsCSV, exportTransactionsCSV, exportLadderPlansCSV, importJSON, importHoldingsCSV, generateCSVImportPreview, applyJSONImport, type ImportPreview } from '@/lib/importExport';
import { PREDEFINED_THEMES, loadThemeSettings, saveThemeSettings, applyTheme, getThemePreviewColors, type ThemeSettings } from '@/lib/themes';
import { SegmentedControl, type SegmentedTab } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';

// =============================================================================
// ADMIN GATING CONFIGURATION
// =============================================================================
// TODO: Replace with backend role check / claim-admin flow
// For now, use VITE_ADMIN_MODE env var or DEV mode as temporary admin flag
// =============================================================================

const IS_ADMIN = import.meta.env.VITE_ADMIN_MODE === 'true' || import.meta.env.DEV;

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

// Top-level section type
type TopSection = 'settings' | 'admin';

// Sub-tab types
type UserSubTab = 'theme' | 'formatting' | 'data';
type AdminSubTab = 'thresholds' | 'providers' | 'tools' | 'strategy-library';
type SubTab = UserSubTab | AdminSubTab;

// =============================================================================
// Top-Level Tab Navigation Component
// =============================================================================
// Tabs feel like "page navigation" - flat, underline indicator, no pill container
// =============================================================================

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TopLevelTabsProps {
  value: string;
  onChange: (value: string) => void;
  tabs: TabItem[];
}

function TopLevelTabs({ value, onChange, tabs }: TopLevelTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border/50">
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        const isAdmin = tab.id === 'admin';
        
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "relative flex items-center gap-2 px-4 py-3 text-sm font-medium",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
              // Active state: stronger text, visible underline
              isActive
                ? isAdmin
                  ? "text-amber-400"
                  : "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            {tab.icon && (
              <span className={cn(
                "transition-colors duration-150",
                isActive
                  ? isAdmin
                    ? "text-amber-400"
                    : "text-primary"
                  : "text-muted-foreground"
              )}>
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            
            {/* Active indicator - underline */}
            {isActive && (
              <span 
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-0.5",
                  isAdmin ? "bg-amber-400" : "bg-primary"
                )}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Main Settings Page Component
// =============================================================================

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<TopSection>('settings');
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

  // Define sub-tabs for each section
  const userSubTabs: SegmentedTab[] = [
    { id: 'theme', label: 'Theme', icon: <Palette className="h-4 w-4" /> },
    { id: 'formatting', label: 'Formatting', icon: <Hash className="h-4 w-4" /> },
    { id: 'data', label: 'Data', icon: <Download className="h-4 w-4" /> },
  ];

  const adminSubTabs: SegmentedTab[] = [
    { id: 'thresholds', label: 'Thresholds', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'providers', label: 'Providers', icon: <Wifi className="h-4 w-4" /> },
    { id: 'tools', label: 'Tools', icon: <FlaskConical className="h-4 w-4" /> },
    { id: 'strategy-library', label: 'Strategy Library', icon: <Library className="h-4 w-4" /> },
  ];

  // Top-level tabs (Settings always visible, Admin only for admins)
  const topLevelTabs: TabItem[] = [
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: <ShieldCheck className="h-4 w-4" /> }] : []),
  ];

  // Safety guard: if admin becomes false while on admin section, reset to settings
  useEffect(() => {
    if (activeSection === 'admin' && !isAdmin) {
      setActiveSection('settings');
      setActiveSubTab('theme');
    }
  }, [isAdmin, activeSection]);

  // Handle section change - also switch to first sub-tab of that section
  const handleSectionChange = (section: string) => {
    const newSection = section as TopSection;
    setActiveSection(newSection);
    if (newSection === 'settings') {
      setActiveSubTab('theme');
    } else if (newSection === 'admin') {
      setActiveSubTab('thresholds');
    }
  };

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


  // Determine which sub-tabs to show based on active section
  const currentSubTabs = activeSection === 'settings' ? userSubTabs : adminSubTabs;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Customize application settings and preferences</p>
      </div>

      {/* Two-level navigation: Tabs (top) + SegmentedControl (sub) */}
      <div className="flex flex-col gap-4">
        {/* Level 1: Top-level section navigation as TABS */}
        <TopLevelTabs
          value={activeSection}
          onChange={handleSectionChange}
          tabs={topLevelTabs}
        />

        {/* Level 2: Sub-tabs as SEGMENTED CONTROL */}
        <SegmentedControl
          value={activeSubTab}
          onChange={(v) => setActiveSubTab(v as SubTab)}
          tabs={currentSubTabs}
          variant={activeSection === 'admin' ? 'amber' : 'default'}
          size="sm"
        />
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

// Reordered theme keys to separate visually similar themes (Slate Minimal and Ocean Flux)
const THEME_GRID_ORDER = [
  'midnight-neon',    // Row 1
  'carbon-shadow',    // Row 1
  'slate-minimal',    // Row 2
  'aurora-mist',      // Row 2
  'graphite-lumina',  // Row 3
  'velvet-dusk',      // Row 3
  'ocean-flux',       // Row 4
  'ember-glow',       // Row 4
];

function ThemeContent({ themeSettings, handleThemeChange, handleHueChange, currentTheme, previewColors }: ThemeContentProps) {
  const handleResetHue = () => {
    handleHueChange([0]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Theme Cards Grid */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Select Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {THEME_GRID_ORDER.map((key) => {
              const theme = PREDEFINED_THEMES[key];
              if (!theme) return null;
              const colors = getThemePreviewColors(key, themeSettings.hueAdjustment);
              const isSelected = themeSettings.selectedTheme === key;
              return (
                <button
                  key={key}
                  onClick={() => handleThemeChange(key)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    isSelected 
                      ? 'border-primary shadow-glow bg-primary/5' 
                      : 'border-border/50 hover:border-primary/50 hover:bg-secondary/30'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex gap-1 h-6">
                      <div className="flex-1 rounded-sm" style={{ backgroundColor: colors.primary }} />
                      <div className="flex-1 rounded-sm" style={{ backgroundColor: colors.secondary }} />
                    </div>
                    <div className="h-4 rounded-sm" style={{ backgroundColor: colors.background }} />
                    <p className="text-xs font-medium truncate">{theme.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Right Column: Preview + Accent Adjustment + Customization */}
      <div className="space-y-4">
        {/* Preview Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mini header bar strip */}
            <div className="rounded-md overflow-hidden border border-border/50">
              <div 
                className="h-8 px-3 flex items-center justify-between"
                style={{ backgroundColor: previewColors.background }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ 
                      background: `linear-gradient(135deg, ${previewColors.primary}, ${previewColors.secondary})` 
                    }}
                  />
                  <span className="text-xs font-medium text-foreground/80">YSL Portfolio</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-8 h-4 rounded-full bg-secondary/50" />
                  <div className="w-8 h-4 rounded-full bg-secondary/50" />
                </div>
              </div>
            </div>

            {/* Button sample */}
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-14">Button</span>
              <button 
                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                style={{ 
                  borderColor: previewColors.primary,
                  background: `linear-gradient(135deg, ${previewColors.primary}15, ${previewColors.secondary}15)`,
                  color: previewColors.primary
                }}
              >
                Add Asset
              </button>
            </div>

            {/* Category pill sample */}
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-14">Category</span>
              <div className="flex gap-1.5">
                <span 
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ 
                    backgroundColor: `${previewColors.primary}20`,
                    color: previewColors.primary
                  }}
                >
                  Blue Chip
                </span>
                <span 
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ 
                    backgroundColor: `${previewColors.secondary}20`,
                    color: previewColors.secondary
                  }}
                >
                  Mid Cap
                </span>
              </div>
            </div>

            {/* Table row sample */}
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground w-14">Table</span>
              <div 
                className="flex-1 rounded-md border border-border/30 overflow-hidden"
                style={{ backgroundColor: `${previewColors.background}80` }}
              >
                <div className="px-3 py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                      style={{ backgroundColor: `${previewColors.primary}30`, color: previewColors.primary }}
                    >
                      B
                    </div>
                    <span className="font-medium">BTC</span>
                  </div>
                  <span className="text-muted-foreground">$97,542.00</span>
                  <span style={{ color: '#22c55e' }}>+2.4%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accent Adjustment Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Accent Adjustment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Slider
                  value={[themeSettings.hueAdjustment]}
                  onValueChange={handleHueChange}
                  min={-180}
                  max={180}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-12 text-right tabular-nums">
                  {themeSettings.hueAdjustment > 0 ? '+' : ''}{themeSettings.hueAdjustment}°
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <div 
                    className="h-6 w-12 rounded border border-border/50" 
                    style={{ backgroundColor: previewColors.primary }} 
                  />
                  <div 
                    className="h-6 w-12 rounded border border-border/50" 
                    style={{ backgroundColor: previewColors.secondary }} 
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleResetHue}
                  disabled={themeSettings.hueAdjustment === 0}
                  className="h-7 text-xs"
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customization Section - Future Options */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Customization
              <Badge variant="outline" className="text-[10px] font-normal">Future</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* High contrast mode */}
            <div className="flex items-center justify-between opacity-50">
              <div className="space-y-0.5">
                <Label className="text-sm">High contrast mode</Label>
                <p className="text-[10px] text-muted-foreground">Coming Soon</p>
              </div>
              <Switch disabled />
            </div>

            {/* Reduced motion */}
            <div className="flex items-center justify-between opacity-50">
              <div className="space-y-0.5">
                <Label className="text-sm">Reduced motion</Label>
                <p className="text-[10px] text-muted-foreground">Coming Soon</p>
              </div>
              <Switch disabled />
            </div>

            {/* Density */}
            <div className="space-y-2 opacity-50">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Density</Label>
                <span className="text-[10px] text-muted-foreground">Coming Soon</span>
              </div>
              <div className="flex gap-1 p-1 rounded-full bg-secondary/40 border border-border/50 w-fit">
                <button 
                  disabled
                  className="px-3 py-1 text-xs rounded-full bg-primary/15 text-foreground/50"
                >
                  Compact
                </button>
                <button 
                  disabled
                  className="px-3 py-1 text-xs rounded-full text-muted-foreground"
                >
                  Roomy
                </button>
              </div>
            </div>

            {/* Accent intensity */}
            <div className="space-y-2 opacity-50">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Accent intensity</Label>
                <span className="text-[10px] text-muted-foreground">Coming Soon</span>
              </div>
              <Slider
                value={[50]}
                min={0}
                max={100}
                step={1}
                disabled
                className="opacity-50"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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
    <div className="space-y-4">
      {/* Decimal Precision Card - Functional */}
      <Card>
        <CardHeader>
          <CardTitle>Decimal Precision</CardTitle>
          <CardDescription>Configure how many decimal places to display</CardDescription>
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

      {/* Currency Display Card - Future */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Currency Display
            <Badge variant="outline" className="text-[10px] font-normal">Future</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 opacity-50">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Display Currency</Label>
              <span className="text-[10px] text-muted-foreground">Coming Soon</span>
            </div>
            <Select value="USD" disabled>
              <SelectTrigger className="pointer-events-none">
                <SelectValue placeholder="USD ($)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="CAD">CAD (C$)</SelectItem>
                <SelectItem value="JPY">JPY (¥)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Number Formatting Options Card - Future */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Number Formatting
            <Badge variant="outline" className="text-[10px] font-normal">Future</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Thousands separators toggle */}
          <div className="flex items-center justify-between opacity-50">
            <div className="space-y-0.5">
              <Label className="text-sm">Thousands separators</Label>
              <p className="text-[10px] text-muted-foreground">Coming Soon</p>
            </div>
            <Switch disabled checked />
          </div>

          {/* Compact notation toggle */}
          <div className="flex items-center justify-between opacity-50">
            <div className="space-y-0.5">
              <Label className="text-sm">Compact notation</Label>
              <p className="text-[10px] text-muted-foreground">Coming Soon · 12,345 → 12.3K</p>
            </div>
            <Switch disabled />
          </div>
        </CardContent>
      </Card>

      {/* Typography Card - Future */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Typography
            <Badge variant="outline" className="text-[10px] font-normal">Future</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Text size segmented control */}
          <div className="space-y-2 opacity-50">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Text Size</Label>
              <span className="text-[10px] text-muted-foreground">Coming Soon</span>
            </div>
            <div className="flex gap-1 p-1 rounded-full bg-secondary/40 border border-border/50 w-fit pointer-events-none">
              <button 
                disabled
                className="px-3 py-1 text-xs rounded-full text-muted-foreground"
              >
                Small
              </button>
              <button 
                disabled
                className="px-3 py-1 text-xs rounded-full bg-primary/15 text-foreground/50"
              >
                Default
              </button>
              <button 
                disabled
                className="px-3 py-1 text-xs rounded-full text-muted-foreground"
              >
                Large
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
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
    <div className="space-y-4">
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

      {/* Advanced Provider Settings - Future */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Advanced Settings
            <Badge variant="outline" className="text-[10px] font-normal">Future</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider Priority */}
          <div className="flex items-center justify-between opacity-50">
            <div className="space-y-0.5">
              <Label className="text-sm">Provider Priority</Label>
              <p className="text-[10px] text-muted-foreground">Coming Soon · Drag to reorder fallback chain</p>
            </div>
            <Button variant="outline" size="sm" disabled>Configure</Button>
          </div>

          {/* Rate Limiting */}
          <div className="flex items-center justify-between opacity-50">
            <div className="space-y-0.5">
              <Label className="text-sm">Rate Limiting</Label>
              <p className="text-[10px] text-muted-foreground">Coming Soon · Per-provider request limits</p>
            </div>
            <Switch disabled />
          </div>

          {/* Custom Endpoints */}
          <div className="flex items-center justify-between opacity-50">
            <div className="space-y-0.5">
              <Label className="text-sm">Custom Endpoints</Label>
              <p className="text-[10px] text-muted-foreground">Coming Soon · Add custom price API endpoints</p>
            </div>
            <Button variant="outline" size="sm" disabled>Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


// Tools Content - embedded admin-only debugging tools
function ToolsContent() {
  const [testResults, setTestResults] = useState<{name: string; passed: boolean; message: string}[]>([]);
  const [storeState, setStoreState] = useState(getStore());
  const [activeToolTab, setActiveToolTab] = useState<'tests' | 'holdings' | 'transactions' | 'settings'>('tests');

  const runTests = () => {
    const results: {name: string; passed: boolean; message: string}[] = [];
    
    // Import test functions from dataModel
    const thresholds = DEFAULT_SETTINGS.thresholds;
    
    // Test categorize function
    const blueChipCat = categorize(12e9, thresholds);
    results.push({
      name: 'categorize(12e9) → blue-chip',
      passed: blueChipCat === 'blue-chip',
      message: `Expected: blue-chip, Got: ${blueChipCat}`,
    });
    
    const midCapCat = categorize(5e9, thresholds);
    results.push({
      name: 'categorize(5e9) → mid-cap',
      passed: midCapCat === 'mid-cap',
      message: `Expected: mid-cap, Got: ${midCapCat}`,
    });
    
    const lowCapCat = categorize(300e6, thresholds);
    results.push({
      name: 'categorize(300e6) → low-cap',
      passed: lowCapCat === 'low-cap',
      message: `Expected: low-cap, Got: ${lowCapCat}`,
    });
    
    const microCapCat = categorize(5e6, thresholds);
    results.push({
      name: 'categorize(5e6) → micro-cap',
      passed: microCapCat === 'micro-cap',
      message: `Expected: micro-cap, Got: ${microCapCat}`,
    });

    setTestResults(results);
    setStoreState({ ...getStore() });
  };

  const refreshStoreState = () => {
    setStoreState({ ...getStore() });
  };

  const passedTests = testResults.filter(t => t.passed).length;

  return (
    <div className="space-y-4">
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
                  Test data model functions, view store state, and run diagnostics.
                </p>
              </div>
            </div>
          </div>

          {/* Tool Tabs */}
          <div className="flex gap-2 flex-wrap">
            {(['tests', 'holdings', 'transactions', 'settings'] as const).map(tab => (
              <Button
                key={tab}
                variant={activeToolTab === tab ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setActiveToolTab(tab); refreshStoreState(); }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'holdings' && ` (${storeState.holdings.length})`}
                {tab === 'transactions' && ` (${storeState.transactions.length})`}
              </Button>
            ))}
          </div>

          {/* Test Runner Tab */}
          {activeToolTab === 'tests' && (
            <div className="space-y-4">
              <Button onClick={runTests} size="sm">
                <FlaskConical className="h-4 w-4 mr-2" />
                Run Categorization Tests
              </Button>
              {testResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Results: {passedTests}/{testResults.length} Passed</p>
                  {testResults.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2 p-2 rounded-lg border text-sm ${
                        result.passed
                          ? 'bg-green-500/10 border-green-500/20'
                          : 'bg-red-500/10 border-red-500/20'
                      }`}
                    >
                      {result.passed ? '✓' : '✗'}
                      <div>
                        <div className="font-medium">{result.name}</div>
                        <div className="text-xs text-muted-foreground">{result.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Holdings Tab */}
          {activeToolTab === 'holdings' && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {storeState.holdings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No holdings in store.</p>
              ) : (
                storeState.holdings.map(h => (
                  <div key={h.id} className="p-2 rounded-lg border glass-panel text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{h.symbol}</span>
                      <span>{h.tokensOwned.toLocaleString()} tokens</span>
                    </div>
                    {h.avgCost && <div className="text-xs text-muted-foreground">Avg: ${h.avgCost.toFixed(2)}</div>}
                  </div>
                ))
              )}
              <div className="p-2 rounded-lg border glass-panel text-sm">
                <div className="font-medium">Cash Balance</div>
                <div className="text-lg">${storeState.cash.toLocaleString()}</div>
              </div>
            </div>
          )}

          {/* Transactions Tab */}
          {activeToolTab === 'transactions' && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {storeState.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transactions recorded.</p>
              ) : (
                storeState.transactions.map(tx => (
                  <div key={tx.id} className="p-2 rounded-lg border glass-panel text-sm flex justify-between">
                    <div>
                      <span className="font-medium">{tx.type.toUpperCase()}</span> {tx.tokens} {tx.symbol}
                      <div className="text-xs text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString()}</div>
                    </div>
                    {tx.totalUsd && <div>${tx.totalUsd.toFixed(2)}</div>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeToolTab === 'settings' && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium mb-1">Market Cap Thresholds</p>
                <div className="space-y-0.5 text-muted-foreground">
                  <p>Blue Chip: ≥${(storeState.settings.thresholds.blueChipMin / 1e9).toFixed(1)}B</p>
                  <p>Mid Cap: ≥${(storeState.settings.thresholds.midCapMin / 1e6).toFixed(0)}M</p>
                  <p>Low Cap: ≥${(storeState.settings.thresholds.lowCapMin / 1e6).toFixed(0)}M</p>
                </div>
              </div>
              <div>
                <p className="font-medium mb-1">Hysteresis</p>
                <div className="space-y-0.5 text-muted-foreground">
                  <p>Buffer: {storeState.settings.hysteresis.percentBuffer}%</p>
                  <p>Min Hours: {storeState.settings.hysteresis.minHours}h</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Strategy Library Content - UI scaffolding with disabled fields (admin-only)
function StrategyLibraryContent() {
  return (
    <div className="space-y-4">
      {/* Feature Preview Notice */}
      <Card>
        <CardContent className="pt-6">
          <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3">
              <Library className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Coming Soon: Strategy Library</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Admin-defined strategy templates that users can select in Exit Strategy.
                  Create reusable exit ladder presets and share them across your portfolio.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Templates Table (Empty State) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Strategy Templates</CardTitle>
              <CardDescription>Saved exit ladder configurations</CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Upload className="h-4 w-4 mr-2" />
              Create Strategy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Empty State Table */}
          <div className="border rounded-lg overflow-hidden opacity-60">
            <div className="grid grid-cols-4 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground">
              <div>Name</div>
              <div>Category</div>
              <div>Rungs</div>
              <div>Actions</div>
            </div>
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Library className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No strategy templates yet</p>
              <p className="text-xs mt-1">Templates will appear here once the feature is enabled</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Strategy Form (Disabled Scaffolding) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Create Strategy
            <Badge variant="outline" className="text-[10px] font-normal">Future</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Strategy Name */}
          <div className="space-y-2 opacity-50">
            <Label className="text-sm">Strategy Name</Label>
            <Input placeholder="e.g., Conservative Blue Chip" disabled />
          </div>

          {/* Description */}
          <div className="space-y-2 opacity-50">
            <Label className="text-sm">Description</Label>
            <Input placeholder="Brief description of this strategy..." disabled />
          </div>

          {/* Target Category */}
          <div className="space-y-2 opacity-50">
            <Label className="text-sm">Target Category</Label>
            <Select disabled>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blue-chip">Blue Chip</SelectItem>
                <SelectItem value="mid-cap">Mid Cap</SelectItem>
                <SelectItem value="low-cap">Low Cap</SelectItem>
                <SelectItem value="all">All Categories</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ladder Rules Preview */}
          <div className="space-y-2 opacity-50">
            <Label className="text-sm">Ladder Rules</Label>
            <div className="border rounded-lg p-3 bg-muted/20">
              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground mb-2">
                <div>Multiplier</div>
                <div>% to Sell</div>
                <div>Action</div>
              </div>
              {[
                { mult: '2x', pct: '25%' },
                { mult: '3x', pct: '25%' },
                { mult: '5x', pct: '25%' },
                { mult: '10x', pct: '25%' },
              ].map((rung, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 py-1 text-sm border-t border-border/30">
                  <div>{rung.mult}</div>
                  <div>{rung.pct}</div>
                  <Button variant="ghost" size="sm" disabled className="h-6 px-2">Edit</Button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">Coming Soon · Configure exit rungs with multipliers and percentages</p>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button disabled className="flex-1">
              Save Strategy
            </Button>
            <Button variant="outline" disabled>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Import/Export Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Import / Export
            <Badge variant="outline" className="text-[10px] font-normal">Future</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
    </div>
  );
}

// Keep AdminPanel export for backward compatibility
export { SettingsPage as AdminPanel };
