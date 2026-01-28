import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Identity } from '@dfinity/agent';

type LoginStatus = 'idle' | 'logging-in' | 'success' | 'error';

interface InternetIdentityContextValue {
  identity: Identity | null;
  principal: string | null;
  isInitializing: boolean;
  isLoggingIn: boolean;
  loginStatus: LoginStatus;
  login: () => Promise<void>;
  clear: () => Promise<void>;
}

const InternetIdentityContext = createContext<InternetIdentityContextValue | undefined>(undefined);

// Internet Identity provider URL - using the new II 2.0 gateway
const II_URL = 'https://id.ai/';

// Session duration: 8 hours in nanoseconds
const SESSION_DURATION = BigInt(8 * 60 * 60 * 1000000000);

export function InternetIdentityProvider({ children }: { children: ReactNode }) {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>('idle');

  // Initialize auth client on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const client = await AuthClient.create({
          idleOptions: {
            // Disable idle timeout for now to avoid unexpected logouts
            disableIdle: true,
          },
        });
        setAuthClient(client);

        // Check if already authenticated
        const isAuthenticated = await client.isAuthenticated();
        if (isAuthenticated) {
          const identity = client.getIdentity();
          const principal = identity.getPrincipal().toString();
          
          // Check if anonymous (not properly authenticated)
          if (principal !== '2vxsx-fae') {
            setIdentity(identity);
            setPrincipal(principal);
            setLoginStatus('success');
            console.log('[Auth] Restored session for principal:', principal);
          } else {
            console.log('[Auth] Anonymous identity detected, treating as logged out');
          }
        }
      } catch (error) {
        console.error('[Auth] Failed to initialize auth client:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async () => {
    if (!authClient) {
      console.error('[Auth] Auth client not initialized');
      return;
    }

    // Check if already authenticated
    const isAuthenticated = await authClient.isAuthenticated();
    if (isAuthenticated) {
      const existingIdentity = authClient.getIdentity();
      const existingPrincipal = existingIdentity.getPrincipal().toString();
      if (existingPrincipal !== '2vxsx-fae') {
        console.log('[Auth] Already authenticated, skipping login');
        setIdentity(existingIdentity);
        setPrincipal(existingPrincipal);
        setLoginStatus('success');
        return;
      }
    }

    setIsLoggingIn(true);
    setLoginStatus('logging-in');

    try {
      await new Promise<void>((resolve, reject) => {
        authClient.login({
          identityProvider: II_URL,
          maxTimeToLive: SESSION_DURATION,
          onSuccess: () => {
            const identity = authClient.getIdentity();
            const principal = identity.getPrincipal().toString();
            
            if (principal === '2vxsx-fae') {
              reject(new Error('Login resulted in anonymous identity'));
              return;
            }
            
            setIdentity(identity);
            setPrincipal(principal);
            setLoginStatus('success');
            console.log('[Auth] Login successful, principal:', principal);
            resolve();
          },
          onError: (error) => {
            console.error('[Auth] Login failed:', error);
            setLoginStatus('error');
            reject(new Error(error || 'Login failed'));
          },
        });
      });
    } catch (error) {
      console.error('[Auth] Login error:', error);
      setLoginStatus('error');
      throw error;
    } finally {
      setIsLoggingIn(false);
    }
  }, [authClient]);

  const clear = useCallback(async () => {
    if (!authClient) {
      console.error('[Auth] Auth client not initialized');
      return;
    }

    setIsLoggingIn(true);
    
    try {
      await authClient.logout();
      setIdentity(null);
      setPrincipal(null);
      setLoginStatus('idle');
      console.log('[Auth] Logout successful');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    } finally {
      setIsLoggingIn(false);
    }
  }, [authClient]);

  const value: InternetIdentityContextValue = {
    identity,
    principal,
    isInitializing,
    isLoggingIn,
    loginStatus,
    login,
    clear,
  };

  return (
    <InternetIdentityContext.Provider value={value}>
      {children}
    </InternetIdentityContext.Provider>
  );
}

export function useInternetIdentity() {
  const ctx = useContext(InternetIdentityContext);
  if (!ctx) {
    throw new Error('useInternetIdentity must be used within InternetIdentityProvider');
  }
  return ctx;
}
