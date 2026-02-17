import { ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { useActor, type UserProfile } from '@/hooks/useActor';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, Settings, Loader2, Target, Pencil, Cog, Menu, X } from 'lucide-react';
import { NamePromptModal } from './NamePromptModal';
import { setSyncProfile, updateProfileAndSave, getSyncProfile } from '@/lib/canisterSync';
import { getStore } from '@/lib/dataModel';
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

// Helper to serialize profile with BigInt support
function serializeProfile(profile: UserProfile): string {
  return JSON.stringify({
    ...profile,
    updatedAt: profile.updatedAt.toString(), // Convert BigInt to string
  });
}

// Helper to deserialize profile with BigInt support
function deserializeProfile(json: string): UserProfile {
  const parsed = JSON.parse(json);
  return {
    ...parsed,
    updatedAt: BigInt(parsed.updatedAt), // Convert string back to BigInt
  };
}

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
  const profileLoadedForPrincipal = useRef<string | null>(null);

  // Load profile when actor is ready OR fall back to localStorage
  // Guarded by ref to prevent re-running when actor reference changes
  useEffect(() => {
    // Skip if we've already loaded for this principal (with actor available)
    if (profileLoadedForPrincipal.current === principal && actor) return;
    // Don't mark as loaded until actor is available (or we have an error)
    if (!actor && !actorError) return;
    
    const loadProfile = async () => {
      // Check if user already skipped the name prompt - if so, never show it again
      const wasSkipped = localStorage.getItem(NAME_PROMPT_SKIPPED_KEY);
      
      if (!isAuthenticated || !principal) {
        setProfile(null);
        return;
      }

      setIsLoadingProfile(true);
      let foundProfile = false;
      
      // First try to load from localStorage (fast)
      const localProfileKey = `${LOCAL_PROFILE_KEY}-${principal}`;
      const localProfile = localStorage.getItem(localProfileKey);
      if (localProfile) {
        try {
          const parsed = deserializeProfile(localProfile);
          setProfile(parsed);
          setSyncProfile({ firstName: parsed.firstName, lastName: parsed.lastName });
          foundProfile = !!(parsed.firstName || parsed.lastName);
          console.log('[Layout] Profile loaded from localStorage:', parsed.firstName, parsed.lastName);
        } catch (e) {
          console.warn('[Layout] Failed to parse local profile:', e);
        }
      }

      // Then try to load from backend (if actor is available)
      if (actor) {
        try {
          const result = await actor.get_profile();
          if (result && result.length > 0 && (result[0].firstName || result[0].lastName)) {
            setProfile(result[0]);
            setSyncProfile({ firstName: result[0].firstName, lastName: result[0].lastName });
            localStorage.setItem(localProfileKey, serializeProfile(result[0]));
            foundProfile = true;
            console.log('[Layout] Profile loaded from backend:', result[0].firstName, result[0].lastName);
            setUseLocalStorage(false);
          } else if (!foundProfile) {
            // Backend returned nothing useful - check canister blob (sync read)
            const blobProfile = getSyncProfile();
            if (blobProfile && (blobProfile.firstName || blobProfile.lastName)) {
              console.log('[Layout] Profile from canister blob (sync read):', blobProfile.firstName, blobProfile.lastName);
              const recovered: UserProfile = {
                firstName: blobProfile.firstName,
                lastName: blobProfile.lastName,
                updatedAt: BigInt(Date.now() * 1000000),
              };
              setProfile(recovered);
              localStorage.setItem(localProfileKey, serializeProfile(recovered));
              localStorage.setItem(NAME_PROMPT_SKIPPED_KEY, 'true');
              foundProfile = true;
            }
            if (!foundProfile && !wasSkipped && !localProfile) {
              console.log('[Layout] No profile found, showing name prompt');
              setShowNamePrompt(true);
            }
          }
        } catch (error) {
          console.error('[Layout] Failed to load profile from backend, using localStorage fallback:', error);
          setUseLocalStorage(true);
          if (!foundProfile && !wasSkipped) {
            setShowNamePrompt(true);
          }
        }
      } else if (actorError) {
        console.log('[Layout] No actor available, using localStorage fallback');
        setUseLocalStorage(true);
        if (!foundProfile && !wasSkipped && !localProfile) {
          setShowNamePrompt(true);
        }
      }
      
      setIsLoadingProfile(false);
      profileLoadedForPrincipal.current = principal;
    };

    loadProfile();
  }, [actor, actorError, isAuthenticated, principal]);

  // Listen for profile loaded from canister blob (cross-device sync)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { firstName: string; lastName: string };
      if (detail && (detail.firstName || detail.lastName)) {
        console.log('[Layout] Profile loaded from canister blob:', detail.firstName, detail.lastName);
        const newProfile: UserProfile = {
          firstName: detail.firstName,
          lastName: detail.lastName,
          updatedAt: BigInt(Date.now() * 1000000),
        };
        setProfile(newProfile);
        // Also cache to localStorage
        if (principal) {
          const localProfileKey = `${LOCAL_PROFILE_KEY}-${principal}`;
          localStorage.setItem(localProfileKey, serializeProfile(newProfile));
        }
        // Mark prompt as skipped since we have a name
        localStorage.setItem(NAME_PROMPT_SKIPPED_KEY, 'true');
        setShowNamePrompt(false);
      }
    };
    window.addEventListener('canister-profile-loaded', handler);
    return () => window.removeEventListener('canister-profile-loaded', handler);
  }, [principal]);

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
      profileLoadedForPrincipal.current = null;
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

    let savedToBackend = false;

    // Try to save to backend first (with timeout)
    if (actor && !useLocalStorage) {
      try {
        // Add a 5-second timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Backend timeout')), 5000)
        );
        const savePromise = actor.upsert_profile(firstName, lastName);
        
        const updatedProfile = await Promise.race([savePromise, timeoutPromise]) as UserProfile;
        setProfile(updatedProfile);
        // Also save to localStorage as backup
        const localProfileKey = `${LOCAL_PROFILE_KEY}-${principal}`;
        localStorage.setItem(localProfileKey, serializeProfile(updatedProfile));
        console.log('[Layout] Profile saved to backend');
        savedToBackend = true;
      } catch (error) {
        console.error('[Layout] Failed to save profile to backend, using localStorage:', error);
        setUseLocalStorage(true);
        // Fall through to localStorage save
      }
    }
    
    // Save to localStorage (either as primary or as fallback)
    if (!savedToBackend) {
      const localProfileKey = `${LOCAL_PROFILE_KEY}-${principal}`;
      localStorage.setItem(localProfileKey, serializeProfile(newProfile));
      setProfile(newProfile);
      console.log('[Layout] Profile saved to localStorage');
    }
    
    setShowNamePrompt(false);
    setIsEditMode(false);
    
    // Mark that we've saved/prompted - don't show modal again automatically
    localStorage.setItem(NAME_PROMPT_SKIPPED_KEY, 'true');

    // Also save profile into the canister portfolio blob for cross-device sync
    updateProfileAndSave({ firstName, lastName }, getStore());
    
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
      localStorage.setItem(localProfileKey, serializeProfile(emptyProfile));
      setProfile(emptyProfile);
    }
    
    setShowNamePrompt(false);
  }, [principal]);

  const handleEditName = () => {
    setIsEditMode(true);
    setShowNamePrompt(true);
  };

  const handleCloseNamePrompt = () => {
    setShowNamePrompt(false);
    setIsEditMode(false);
  };

  // Get display name
  const displayName = profile?.firstName || profile?.lastName
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar - 64px height with refined spacing */}
      <header className="border-b border-divide-lighter/25 glass-panel sticky top-0 z-50 h-14 sm:h-16">
        <div className="container mx-auto px-4 sm:px-6 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Left: Minimal Brand */}
            <div className="flex items-center space-x-2 sm:space-x-2.5">
              <img
                src="/yieldschool-logo.jpeg"
                alt="Yieldschool"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover"
              />
              <div className="flex items-baseline gap-1 sm:gap-1.5">
                <h1 className="text-sm sm:text-base font-bold font-heading tracking-tight gradient-underline">
                  Yieldschool
                </h1>
                <span className="hidden sm:inline text-sm text-foreground/60 font-medium">Portfolio Tracker</span>
              </div>
            </div>

            {/* Center: Navigation Tabs - hidden on mobile (shown in bottom nav) */}
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
            <div className="flex items-center space-x-2 sm:space-x-4">
              {isAuthenticated && !isLoadingProfile && !actorFetching && (
                <button
                  onClick={handleEditName}
                  className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth group compact-btn"
                >
                  {displayName ? (
                    <span>{displayName}</span>
                  ) : (
                    <span className="text-muted-foreground/70">Add name</span>
                  )}
                  <Pencil className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
              )}

              {isAuthenticated && identity ? (
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <button
                    onClick={handleAuth}
                    disabled={isLoggingIn}
                    className="gradient-outline-btn text-xs sm:text-sm transition-smooth disabled:opacity-50 inline-flex items-center gap-1.5 sm:gap-2 compact-btn !min-h-[36px] !min-w-0"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                          <span className="hidden sm:inline">Disconnecting...</span>
                          <span className="sm:hidden">...</span>
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
                  className="gradient-outline-btn text-xs sm:text-sm transition-smooth disabled:opacity-50 inline-flex items-center gap-1.5 sm:gap-2 compact-btn !min-h-[36px] !min-w-0"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                        <span className="hidden sm:inline">Connecting...</span>
                        <span className="sm:hidden">...</span>
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
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-5">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation - only for authenticated users */}
      {isAuthenticated && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-divide-lighter/25 glass-panel mobile-nav-bar">
          <div className="flex items-center justify-around px-2 py-2">
            <button
              onClick={() => onTabChange('portfolio')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-smooth compact-btn !min-h-0 !min-w-0 ${
                activeTab === 'portfolio'
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <Wallet className="h-5 w-5" />
              Portfolio
            </button>
            <button
              onClick={() => onTabChange('exit-strategy')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-smooth compact-btn !min-h-0 !min-w-0 ${
                activeTab === 'exit-strategy'
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <Target className="h-5 w-5" />
              Exits
            </button>
            <button
              onClick={() => onTabChange('market')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-smooth compact-btn !min-h-0 !min-w-0 ${
                activeTab === 'market'
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <TrendingUp className="h-5 w-5" />
              Market
            </button>
            <button
              onClick={() => onTabChange('settings')}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-smooth compact-btn !min-h-0 !min-w-0 ${
                activeTab === 'settings'
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <Cog className="h-5 w-5" />
              Settings
            </button>
          </div>
        </nav>
      )}

      {/* Name Prompt Modal */}
      <NamePromptModal
        open={showNamePrompt}
        onSave={handleSaveProfile}
        onSkip={handleSkipProfile}
        onClose={handleCloseNamePrompt}
        isLoading={isSavingProfile}
        initialFirstName={profile?.firstName || ''}
        initialLastName={profile?.lastName || ''}
        isEditMode={isEditMode}
      />
    </div>
  );
}
