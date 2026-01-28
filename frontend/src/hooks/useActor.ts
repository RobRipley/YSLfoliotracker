import { useState, useEffect } from 'react';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { useInternetIdentity } from './useInternetIdentity';

// Import the candid interface from the generated declarations
// We'll define the interface inline since declarations might not exist yet

export interface UserProfile {
  firstName: string;
  lastName: string;
  updatedAt: bigint;
}

export interface BackendActor {
  get_profile: () => Promise<[] | [UserProfile]>;
  upsert_profile: (firstName: string, lastName: string) => Promise<UserProfile>;
  getCallerUserProfile: () => Promise<[] | [UserProfile]>;
  saveCallerUserProfile: (profile: UserProfile) => Promise<void>;
  initializeAccessControl: () => Promise<void>;
  getCallerUserRole: () => Promise<{ admin: null } | { user: null } | { guest: null }>;
  // Add more methods as needed
}

// IDL factory for the backend canister
const idlFactory = ({ IDL }: { IDL: any }) => {
  const UserProfile = IDL.Record({
    firstName: IDL.Text,
    lastName: IDL.Text,
    updatedAt: IDL.Int,
  });
  
  const UserRole = IDL.Variant({
    admin: IDL.Null,
    user: IDL.Null,
    guest: IDL.Null,
  });

  return IDL.Service({
    get_profile: IDL.Func([], [IDL.Opt(UserProfile)], ['query']),
    upsert_profile: IDL.Func([IDL.Text, IDL.Text], [UserProfile], []),
    getCallerUserProfile: IDL.Func([], [IDL.Opt(UserProfile)], ['query']),
    saveCallerUserProfile: IDL.Func([UserProfile], [], []),
    initializeAccessControl: IDL.Func([], [], []),
    getCallerUserRole: IDL.Func([], [UserRole], ['query']),
  });
};

// Get canister ID from environment or use local default
const getBackendCanisterId = (): string => {
  // Check for environment variable first
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_CANISTER_ID) {
    return import.meta.env.VITE_BACKEND_CANISTER_ID;
  }
  
  // Check if we're on IC mainnet
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.ic0.app')) {
    // Parse canister ID from URL for IC deployment
    const match = window.location.hostname.match(/^([a-z0-9-]+)\.ic0\.app$/);
    if (match) {
      // This is the frontend canister ID, we need the backend one
      // For now, use a placeholder - this should be configured properly
      console.warn('[Actor] Running on IC but backend canister ID not configured');
    }
  }
  
  // Default to local canister ID
  return 'uxrrr-q7777-77774-qaaaq-cai';
};

// Get the IC host based on environment
const getHost = (): string => {
  if (typeof window !== 'undefined') {
    // On IC mainnet
    if (window.location.hostname.endsWith('.ic0.app') || 
        window.location.hostname.endsWith('.icp0.io')) {
      return 'https://icp-api.io';
    }
  }
  // Local development
  return 'http://127.0.0.1:4943';
};

export function useActor() {
  const { identity, principal } = useInternetIdentity();
  const [actor, setActor] = useState<BackendActor | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const createActor = async () => {
      if (!identity || !principal) {
        setActor(null);
        return;
      }

      // Skip anonymous identity
      if (principal === '2vxsx-fae') {
        setActor(null);
        return;
      }

      setIsFetching(true);
      setError(null);

      try {
        const host = getHost();
        const canisterId = getBackendCanisterId();
        
        console.log('[Actor] Creating actor with:', { host, canisterId, principal });

        const agent = await HttpAgent.create({
          identity: identity as Identity,
          host,
        });

        // Fetch root key for local development
        if (host.includes('127.0.0.1') || host.includes('localhost')) {
          await agent.fetchRootKey();
        }

        const actorInstance = Actor.createActor<BackendActor>(idlFactory, {
          agent,
          canisterId,
        });

        // Initialize access control for new users
        try {
          await actorInstance.initializeAccessControl();
          console.log('[Actor] Access control initialized');
        } catch (e) {
          // This is expected to fail if already initialized
          console.log('[Actor] Access control already initialized or error:', e);
        }

        setActor(actorInstance);
        console.log('[Actor] Actor created successfully');
      } catch (err) {
        console.error('[Actor] Failed to create actor:', err);
        setError(err instanceof Error ? err : new Error('Failed to create actor'));
      } finally {
        setIsFetching(false);
      }
    };

    createActor();
  }, [identity, principal]);

  return { actor, isFetching, error };
}
