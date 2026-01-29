import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { Layout } from '@/components/Layout';
import { Landing } from '@/pages/Landing';
import { Portfolio } from '@/components/Portfolio';
import { Market } from '@/components/Market';
import { AdminPanel } from '@/components/AdminPanel';
import { DataModelTest } from '@/pages/DataModelTest';
import { ExitStrategy } from '@/pages/ExitStrategy';
import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { loadThemeSettings, applyTheme } from '@/lib/themes';
import { ErrorBoundary, setupGlobalErrorHandlers } from '@/components/ErrorBoundary';
import { initializeMarketData } from '@/lib/marketDataService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

type Tab = 'landing' | 'portfolio' | 'exit-strategy' | 'market' | 'admin' | 'test';

const TAB_STORAGE_KEY = 'ysl-active-tab';
const VALID_TABS: Tab[] = ['landing', 'portfolio', 'exit-strategy', 'market', 'admin', 'test'];

// Load persisted tab from localStorage
function loadPersistedTab(): Tab {
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY);
    if (stored && VALID_TABS.includes(stored as Tab)) {
      return stored as Tab;
    }
  } catch (e) {
    console.warn('[App] Failed to load persisted tab:', e);
  }
  return 'landing';
}

// Save tab to localStorage
function persistTab(tab: Tab): void {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch (e) {
    console.warn('[App] Failed to persist tab:', e);
  }
}

function AppContent() {
  // Initialize with persisted tab, but default to landing if not authenticated
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    // We'll check auth state after initialization
    return loadPersistedTab();
  });
  const { identity, isInitializing } = useInternetIdentity();

  // Apply theme on mount
  useEffect(() => {
    const themeSettings = loadThemeSettings();
    applyTheme(themeSettings.selectedTheme, themeSettings.hueAdjustment);
  }, []);

  // Setup global error handlers on mount
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  // Initialize market data cache on mount (warm cache for instant categorization)
  useEffect(() => {
    initializeMarketData();
  }, []);

  // Handle authentication state changes
  useEffect(() => {
    if (isInitializing) return;
    
    if (!identity) {
      // Not authenticated - force landing page
      if (activeTab !== 'landing') {
        setActiveTab('landing');
        persistTab('landing');
      }
    } else {
      // Authenticated - if we're on landing but persisted tab was something else, restore it
      const persisted = loadPersistedTab();
      if (activeTab === 'landing' && persisted !== 'landing' && VALID_TABS.includes(persisted)) {
        setActiveTab(persisted);
      }
    }
  }, [identity, isInitializing, activeTab]);

  // Persist tab changes with logging
  const handleTabChange = useCallback((tab: Tab) => {
    console.log(`[App] Tab change: ${activeTab} -> ${tab}`);
    setActiveTab(tab);
    persistTab(tab);
  }, [activeTab]);

  const handleEnterPortfolio = useCallback(() => {
    handleTabChange('portfolio');
  }, [handleTabChange]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange} onEnterPortfolio={handleEnterPortfolio}>
      <ErrorBoundary>
        {activeTab === 'landing' && <Landing onEnterPortfolio={handleEnterPortfolio} />}
        {activeTab === 'portfolio' && <Portfolio />}
        {activeTab === 'exit-strategy' && <ExitStrategy />}
        {activeTab === 'market' && <Market />}
        {activeTab === 'admin' && <AdminPanel />}
        {activeTab === 'test' && <DataModelTest />}
      </ErrorBoundary>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
