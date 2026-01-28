import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { useActor, type UserProfile } from '@/hooks/useActor';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, Settings, FlaskConical, Loader2, Target, Pencil } from 'lucide-react';
import { NamePromptModal } from './NamePromptModal';
import { toast } from 'sonner';

type Tab = 'landing' | 'portfolio' | 'exit-strategy' | 'market' | 'admin' | 'test';

interface LayoutProps {
  children: ReactNode;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onEnterPortfolio: () => void;
}

// Storage key for tracking if first login prompt was shown
const FIRST_LOGIN_PROMPTED_KEY = 'ysl-first-login-prompted';

export function Layout({ children, activeTab, onTabChange, onEnterPortfolio }: LayoutProps) {
  const { login, clear, identity, principal, isLoggingIn, loginStatus } = useInternetIdentity();
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();
  const isAuthenticated = identity !== null && principal !== null && principal !== '2vxsx-fae';

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Load profile when actor is ready
  useEffect(() => {
    const loadProfile = async () => {
      if (!actor || !isAuthenticated) {
        setProfile(null);
        return;
      }

      setIsLoadingProfile(true);
      try {
        const result = await actor.get_profile();
        if (result && result.length > 0) {
          setProfile(result[0]);
          console.log('[Layout] Profile loaded:', result[0]);
        } else {
          // No profile exists - check if we should show prompt
          const wasPrompted = localStorage.getItem(`${FIRST_LOGIN_PROMPTED_KEY}-${principal}`);
          if (!wasPrompted) {
            console.log('[Layout] No profile found, showing name prompt');
            setShowNamePrompt(true);
          }
        }
      } catch (error) {
        console.error('[Layout] Failed to load profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, [actor, isAuthenticated, principal]);

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
    if (!actor) return;

    setIsSavingProfile(true);
    try {
      const updatedProfile = await actor.upsert_profile(firstName, lastName);
      setProfile(updatedProfile);
      setShowNamePrompt(false);
      setIsEditMode(false);
      
      // Mark that we've prompted this user
      if (principal) {
        localStorage.setItem(`${FIRST_LOGIN_PROMPTED_KEY}-${principal}`, 'true');
      }
      
      toast.success(firstName || lastName ? 'Name saved!' : 'Profile updated');
    } catch (error) {
      console.error('[Layout] Failed to save profile:', error);
      toast.error('Failed to save name. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  }, [actor, principal]);

  const handleSkipProfile = useCallback(async () => {
    if (!actor) return;

    setIsSavingProfile(true);
    try {
      // Save empty profile to prevent nagging
      const updatedProfile = await actor.upsert_profile('', '');
      setProfile(updatedProfile);
      setShowNamePrompt(false);
      
      // Mark that we've prompted this user
      if (principal) {
        localStorage.setItem(`${FIRST_LOGIN_PROMPTED_KEY}-${principal}`, 'true');
      }
    } catch (error) {
      console.error('[Layout] Failed to skip profile:', error);
    } finally {
      setIsSavingProfile(false);
    }
  }, [actor, principal]);

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
