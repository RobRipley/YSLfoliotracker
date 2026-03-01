import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { Loader2 } from 'lucide-react';
import { getActiveBrand } from '@/lib/branding';

interface LandingProps {
  onEnterPortfolio: () => void;
}

export function Landing({ onEnterPortfolio }: LandingProps) {
  const { login, isLoggingIn } = useInternetIdentity();
  const brand = getActiveBrand();

  const handleSignIn = async () => {
    try {
      await login();
      // Navigation to portfolio happens via useEffect in Layout.tsx
    } catch (error: any) {
      console.error('Login failed:', error);
      // If user is already authenticated, clear and retry
      if (error.message === 'User is already authenticated') {
        // This will be handled by Layout.tsx
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center atmospheric-bg px-4">
      <div className="text-center space-y-6 sm:space-y-8 max-w-3xl px-2 sm:px-6 relative z-10">
        <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold font-heading text-foreground tracking-tight">
          <span className="gradient-underline">{brand.landingH1}</span>
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground font-light tracking-tight">
          A calm way to track crypto performance.
        </p>
        <button 
          onClick={handleSignIn}
          disabled={isLoggingIn}
          className="gradient-outline-btn text-base transition-smooth disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-gradient-brand font-semibold">
                Connecting...
              </span>
            </>
          ) : (
            <span className="text-gradient-brand font-semibold">
              Sign In to Portfolio
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
