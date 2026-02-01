import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { useActor, type UserProfile } from '@/hooks/useActor';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, Settings, Loader2, Target, Pencil, Cog } from 'lucide-react';
import { NamePromptModal } from './NamePromptModal';
import { toast } from 'sonner';

type Tab = 'landing' | 'portfolio' | 'exit-strategy' | 'market' | 'settings';

interface LayoutProps {
  children: ReactNode;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onEnterPortfolio: () => void;
}

// Storage keys
const NAME_PROMPT_SKIPPED_KEY = 'ysl-name-prompt-skipped';
const LOCAL_PROFILE_KEY = 'ysl-local-profile';

export function Layout({ children, activeTab, onTabChange, onEnterPortfolio }: LayoutProps) {
  const { login, clear, identity, principal, isLoggingIn, loginStatus } = useInternetIdentity();
  const { actor, isFetching: actorFetching, error: actorError } = useActor();
  const queryClient = useQueryClient();
  const isAuthenticated = identity !== null && principal !== null && principal !== '2vxsx-fae';

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [useLocalStorage, setUseLocalStorage] = useState(false);

  // Load profile when actor is ready OR fall back to localStorage
  useEffect(() => {
    const loadProfile = async () => {
      // Check if user already skipped the name prompt - if so, never show it again
      const wasSkipped = localStorage.getItem(NAME_PROMPT_SKIPPED_KEY);
      
      if (!isAuthenticated || !principal) {
        setProfile(null);
        return;
      }

      setIsLoadingProfile(true);
      
      // First try to load from localStorage (fast)
      const localProfileKey = `${LOCAL_PROFILE_KEY}-${principal}`;
      const localProfile = localStorage.getItem(localProfileKey);
      if (localProfile) {
        try {
          const parsed = JSON.parse(localProfile);
          setProfile(parsed);
          console.log('[Layout] Profile loaded from localStorage:', parsed);
        } catch (e) {
          console.warn('[Layout] Failed to parse local profile:', e);
        }
      }

      // Then try to load from backend (if actor is available)
      if (actor) {
        try {
          const result = await actor.get_profile();
          if (result && result.length > 0) {
            setProfile(result[0]);
            // Sync to localStorage
            localStorage.setItem(localProfileKey, JSON.stringify(result[0]));
            console.log('[Layout] Profile loaded from backend:', result[0]);
            setUseLocalStorage(false);
          } else {
            // No profile exists on backend - check if we should show prompt
            if (!wasSkipped && !localProfile) {
              console.log('[Layout] No profile found, showing name prompt');
              setShowNamePrompt(true);
            }
          }
        } catch (error) {
          console.error('[Layout] Failed to load profile from backend, using localStorage fallback:', error);
          setUseLocalStorage(true);
          // Show a one-time warning toast if actor fails
          if (!localProfile && !wasSkipped) {
            setShowNamePrompt(true);
          }
        }
      } else if (actorError) {
        console.log('[Layout] No actor available, using localStorage fallback');
        setUseLocalStorage(true);
        // Check if we should show prompt
        if (!wasSkipped && !localProfile) {
          setShowNamePrompt(true);
        }
      }
      
      setIsLoadingProfile(false);
    };

    loadProfile();
  }, [actor, actorError, isAuthenticated, principal]);

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
      setProfile(null);
      setUseLocalStorage(false);
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
      }
    }
  };

  const handleSaveProfile = useCallback(async (firstName: string, lastName: string) => {
    if (!principal) return;

    setIsSavingProfile(true);
    
    const newProfile: UserProfile = {
      firstName,
      lastName,
      updatedAt: BigInt(Date.now() * 1000000), // nanoseconds
    };

    // Try to save to backend first
    if (actor && !useLocalStorage) {
      try {
        const updatedProfile = await actor.upsert_profile(firstName, lastName);
        setProfile(updatedProfile);
        // Also save to localStorage as backup
        const localProfileKey = `${LOCAL_PROFILE_KEY}-${principal}`;
        localStorage.setItem(localProfileKey, JSON.stringify(updatedProfile));
        console.log('[Layout] Profile saved to backend');
      } catch (error) {
        console.error('[Layout] Failed to save profile to backend, using localStorage:', error);
        setUseLocalStorage(true);
        // Fall through to localStorage save
      }
    }
    
    // Save to localStorage (either as primary or as fallback)
    if (useLocalStorage || !actor) {
      const localProfileKey = `${LOCAL_PROFILE_KEY}-${principal}`;
      localStorage.setItem(localProfileKey, JSON.stringify(newProfile));
      setProfile(newProfile);
      console.log('[Layout] Profile saved to localStorage');
    }
    
    setShowNamePrompt(false);
    setIsEditMode(false);
    
    // Mark that we've saved/prompted - don't show modal again automatically
    localStorage.setItem(NAME_PROMPT_SKIPPED_KEY, 'true');
    
    toast.success(firstName || lastName ? 'Name saved!' : 'Profile updated');
    setIsSavingProfile(false);
  }, [actor, principal, useLocalStorage]);

  const handleSkipProfile = useCallback(() => {
    // Set the skip flag immediately - this prevents the modal from ever showing again
    localStorage.setItem(NAME_PROMPT_SKIPPED_KEY, 'true');
    
    if (principal) {
      const emptyProfile: UserProfile = {
        firstName: '',
        lastName: '',
        updatedAt: BigInt(Date.now() * 1000000),
      };

      const localProfileKey = `${LOCAL_PROFILE_KEY}-${principal}`;
      localStorage.setItem(localProfileKey, JSON.stringify(emptyProfile));
      setProfile(emptyProfile);
    }
    
    setShowNamePrompt(false);
  }, [principal]);

  const handleEditName = () => {
    setIsEditMode(true);
    setShowNamePrompt(true);
  };

  // Get display name
  const displayName = profile?.firstName || profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar - 64px height with refined spacing */}
      <header className="border-b border-divide-lighter/25 glass-panel sticky top-0 z-50 h-16">
        <div className="container mx-auto px-6 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Left: Minimal Brand */}
            <div className="flex items-center space-x-2.5">
              <img 
                src="/yieldschool-logo.jpeg" 
                alt="Yieldschool" 
                className="w-9 h-9 rounded-lg object-cover"
              />
              <div className="flex items-baseline gap-1.5">
                <h1 className="text-base font-bold font-heading tracking-tight gradient-underline">
                  Yieldschool
                </h1>
                <span className="text-sm text-foreground/60 font-medium">Portfolio Tracker</span>
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
                  onClick={() => onTabChange('settings')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-smooth ${
                    activeTab === 'settings' 
                      ? 'text-foreground bg-secondary/12 shadow-xs' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/6'
                  }`}
                >
                  <Cog className="h-4 w-4" />
                  Settings
                </button>
              </nav>
            )}

            {/* Right: Name Display + Auth Button */}
            <div className="flex items-center space-x-4">
              {isAuthenticated && !isLoadingProfile && !actorFetching && (
                <button
                  onClick={handleEditName}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth group"
                >
                  {displayName ? (
                    <span className="hidden sm:inline">{displayName}</span>
                  ) : (
                    <span className="hidden sm:inline text-muted-foreground/70">Add name</span>
                  )}
                  <Pencil className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
              
              {isAuthenticated && identity ? (
                <div className="flex items-center space-x-3">
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

      {/* Footer with attribution */}
      <footer className="border-t border-border/10 py-3 text-center">
        <p className="text-xs text-muted-foreground/60">
          Prices powered by{' '}
          <a 
            href="https://cryptorates.ai" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-muted-foreground/80 hover:text-foreground transition-colors"
          >
            cryptorates.ai
          </a>
        </p>
      </footer>

      {/* Name Prompt Modal */}
      <NamePromptModal
        open={showNamePrompt}
        onSave={handleSaveProfile}
        onSkip={handleSkipProfile}
        isLoading={isSavingProfile}
        initialFirstName={profile?.firstName || ''}
        initialLastName={profile?.lastName || ''}
        isEditMode={isEditMode}
      />
    </div>
  );
}
