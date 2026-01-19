import { useState, useEffect } from 'react';
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

type Tab = 'landing' | 'portfolio' | 'exit-strategy' | 'market' | 'admin' | 'test';

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('landing');
  const { identity, isInitializing } = useInternetIdentity();

  // Apply theme on mount
  useEffect(() => {
    const themeSettings = loadThemeSettings();
    applyTheme(themeSettings.selectedTheme, themeSettings.hueAdjustment);
  }, []);

  // Redirect to landing if not authenticated
  useEffect(() => {
    if (!isInitializing && !identity && activeTab !== 'landing') {
      setActiveTab('landing');
    }
  }, [identity, isInitializing, activeTab]);

  const handleEnterPortfolio = () => {
    setActiveTab('portfolio');
  };

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
    <Layout activeTab={activeTab} onTabChange={setActiveTab} onEnterPortfolio={handleEnterPortfolio}>
      {activeTab === 'landing' && <Landing onEnterPortfolio={handleEnterPortfolio} />}
      {activeTab === 'portfolio' && <Portfolio />}
      {activeTab === 'exit-strategy' && <ExitStrategy />}
      {activeTab === 'market' && <Market />}
      {activeTab === 'admin' && <AdminPanel />}
      {activeTab === 'test' && <DataModelTest />}
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <AppContent />
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
