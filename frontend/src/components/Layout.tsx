import { ReactNode, useEffect } from 'react';
import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, Settings, FlaskConical, Heart, Loader2, Target } from 'lucide-react';

type Tab = 'landing' | 'portfolio' | 'exit-strategy' | 'market' | 'admin' | 'test';

interface LayoutProps {
  children: ReactNode;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onEnterPortfolio: () => void;
}

export function Layout({ children, activeTab, onTabChange, onEnterPortfolio }: LayoutProps) {
  const { login, clear, identity, isLoggingIn, loginStatus } = useInternetIdentity();
  const queryClient = useQueryClient();
  const isAuthenticated = identity !== null;

  // Watch for successful login and transition to portfolio
  useEffect(() => {
    if (loginStatus === 'success' && identity && activeTab === 'landing') {
      const timer = setTimeout(() => {
        onEnterPortfolio();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loginStatus, identity, activeTab, onEnterPortfolio]);

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      // Clear all cached data on logout
      queryClient.clear();
      // Navigate to landing
      onTabChange('landing');
    } else {
      try {
        await login();
        // Navigation to portfolio happens via useEffect above
      } catch (error: any) {
        console.error('Auth error:', error);
        if (error.message === 'User is already authenticated') {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar - 64px height with refined spacing */}
      <header className="border-b border-divide-lighter/25 glass-panel sticky top-0 z-50 h-16">
        <div className="container mx-auto px-6 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Left: Minimal Brand */}
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#22d3ee] to-[#a78bfa] opacity-12"></div>
                <span className="relative text-foreground font-bold text-xl">Y</span>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold font-heading tracking-tight gradient-underline">
                  Yieldschool
                </h1>
                <span className="text-sm text-muted-foreground font-medium">Portfolio Tracker</span>
              </div>
            </div>

            {/* Center: Navigation Tabs with refined hover states */}
            {isAuthenticated && (
              <nav className="hidden md:flex space-x-1">
                <button
                  onClick={() => onTabChange('portfolio')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-smooth ${
                    activeTab === 'portfolio' 
                      ? 'text-foreground bg-secondary/12 shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/6'
                  }`}
                >
                  <Wallet className="h-4 w-4" />
                  Portfolio
                </button>
                <button
                  onClick={() => onTabChange('exit-strategy')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-smooth ${
                    activeTab === 'exit-strategy' 
                      ? 'text-foreground bg-secondary/12 shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/6'
                  }`}
                >
                  <Target className="h-4 w-4" />
                  Exit Strategy
                </button>
                <button
                  onClick={() => onTabChange('market')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-smooth ${
                    activeTab === 'market' 
                      ? 'text-foreground bg-secondary/12 shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/6'
                  }`}
                >
                  <TrendingUp className="h-4 w-4" />
                  Market
                </button>
                <button
                  onClick={() => onTabChange('admin')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-smooth ${
                    activeTab === 'admin' 
                      ? 'text-foreground bg-secondary/12 shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/6'
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  Admin
                </button>
                <button
                  onClick={() => onTabChange('test')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-smooth ${
                    activeTab === 'test' 
                      ? 'text-foreground bg-secondary/12 shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/6'
                  }`}
                >
                  <FlaskConical className="h-4 w-4" />
                  Test
                </button>
              </nav>
            )}

            {/* Right: Auth Button - Matching Landing page gradient styling */}
            <div className="flex items-center space-x-4">
              {isAuthenticated && identity ? (
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-muted-foreground hidden sm:block font-mono">
                    {identity.getPrincipal().toString().slice(0, 8)}...
                  </div>
                  <button 
                    onClick={handleAuth} 
                    disabled={isLoggingIn}
                    className="gradient-outline-btn text-sm transition-smooth disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                          Disconnecting...
                        </span>
                      </>
                    ) : (
                      <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                        Sign Out
                      </span>
                    )}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleAuth} 
                  disabled={isLoggingIn} 
                  className="gradient-outline-btn text-sm transition-smooth disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                        Connecting...
                      </span>
                    </>
                  ) : (
                    <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                      Sign In
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with refined spacing rhythm */}
      <main className="flex-1">
        <div className="container mx-auto px-6 py-5">
          {children}
        </div>
      </main>

      {/* Footer with refined border */}
      <footer className="border-t border-divide-lighter/25 mt-12 py-6 glass-panel">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p className="flex items-center justify-center gap-2">
            © 2025. Built with <Heart className="h-4 w-4 text-neon-danger fill-neon-danger" /> using{' '}
            <a 
              href="https://caffeine.ai" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="underline hover:text-foreground transition-smooth inline-flex items-center gap-1"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
