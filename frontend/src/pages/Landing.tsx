import { useInternetIdentity } from '@/hooks/useInternetIdentity';
import { Loader2, Shield, Target, BarChart3 } from 'lucide-react';
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
      if (error.message === 'User is already authenticated') {
        // This will be handled by Layout.tsx
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center atmospheric-bg px-4 relative overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 hero-mesh pointer-events-none" />

      {/* Subtle floating orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-[0.03] blur-3xl pointer-events-none"
        style={{
          background: 'var(--brand-gradient-from)',
          animation: 'mesh-drift 15s ease-in-out infinite reverse',
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-[0.03] blur-3xl pointer-events-none"
        style={{
          background: 'var(--brand-gradient-to)',
          animation: 'mesh-drift 18s ease-in-out infinite',
        }}
      />

      {/* Main hero content */}
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

      {/* Feature triptych */}
      <div className="relative z-10 mt-16 sm:mt-24 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-3xl w-full px-2 sm:px-6">
        <FeatureCard
          icon={<BarChart3 className="h-5 w-5" />}
          title="Track Everything"
          description="Live prices, allocation charts, and category breakdowns for your entire portfolio."
          index={0}
        />
        <FeatureCard
          icon={<Target className="h-5 w-5" />}
          title="Plan Your Exits"
          description="Set exit ladders with price targets so you take profits without emotion."
          index={1}
        />
        <FeatureCard
          icon={<Shield className="h-5 w-5" />}
          title="On-Chain Storage"
          description="Your data lives on the Internet Computer. No accounts, no third parties."
          index={2}
        />
      </div>

      {/* Trust signal */}
      <div className="relative z-10 mt-10 sm:mt-14 text-center">
        <p className="text-[11px] text-muted-foreground/40 tracking-wide">
          Powered by Internet Computer &middot; Secured by Internet Identity
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  index = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  index?: number;
}) {
  return (
    <div className="glass-panel rounded-xl p-4 sm:p-5 text-center sm:text-left space-y-2 stagger-item group hover:border-divide-lighter/30 transition-smooth"
      style={{ animationDelay: `${200 + index * 100}ms` }}
    >
      <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--brand-gradient-from)]/10 to-[var(--brand-gradient-to)]/10 text-foreground/70 group-hover:text-foreground transition-smooth">
        {icon}
      </div>
      <h3 className="text-sm font-semibold font-heading text-foreground/90">{title}</h3>
      <p className="text-xs text-muted-foreground/60 leading-relaxed">{description}</p>
    </div>
  );
}
