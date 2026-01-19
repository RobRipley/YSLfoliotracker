import { createContext, useContext, ReactNode } from 'react';

type LoginStatus = 'idle' | 'logging-in' | 'success' | 'error';

interface StubPrincipal {
  toString: () => string;
}

interface StubIdentity {
  getPrincipal: () => StubPrincipal;
}

interface InternetIdentityContextValue {
  identity: StubIdentity | null;
  isInitializing: boolean;
  isLoggingIn: boolean;
  loginStatus: LoginStatus;
  login: () => Promise<void>;
  clear: () => Promise<void>;
}

const InternetIdentityContext = createContext<InternetIdentityContextValue | undefined>(undefined);

export function InternetIdentityProvider({ children }: { children: ReactNode }) {
  const stubIdentity: StubIdentity = {
    getPrincipal: () => ({
      toString: () => 'dev-user-principal'
    })
  };

  const value: InternetIdentityContextValue = {
    identity: stubIdentity,
    isInitializing: false,
    isLoggingIn: false,
    loginStatus: 'success',
    login: async () => {},
    clear: async () => {}
  };

  return <InternetIdentityContext.Provider value={value}>{children}</InternetIdentityContext.Provider>;
}

export function useInternetIdentity() {
  const ctx = useContext(InternetIdentityContext);
  if (!ctx) {
    throw new Error('useInternetIdentity must be used within InternetIdentityProvider');
  }
  return ctx;
}