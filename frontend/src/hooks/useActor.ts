import { useState, useEffect, useRef } from 'react';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { useInternetIdentity } from './useInternetIdentity';

// ============================================================================
// Types matching the backend Candid interface
// ============================================================================

export interface UserProfile {
  firstName: string;
  lastName: string;
  updatedAt: bigint;
}

export interface BackendActor {
  // Profile methods
  get_profile: () => Promise<[] | [UserProfile]>;
  upsert_profile: (firstName: string, lastName: string) => Promise<UserProfile>;
  getCallerUserProfile: () => Promise<[] | [UserProfile]>;
  saveCallerUserProfile: (profile: UserProfile) => Promise<void>;
  initializeAccessControl: () => Promise<void>;
  getCallerUserRole: () => Promise<{ admin: null } | { user: null } | { guest: null }>;
  
  // Portfolio blob storage methods
  save_portfolio_blob: (jsonBlob: string) => Promise<{ ok: boolean; timestamp: bigint }>;
  load_portfolio_blob: () => Promise<[] | [string]>;
  get_portfolio_timestamp: () => Promise<[] | [bigint]>;
  delete_portfolio_blob: () => Promise<{ ok: boolean }>;

  // Shared logo registry methods
  get_logo_registry: () => Promise<Array<[string, string]>>;
  set_logo: (coingeckoId: string, logoUrl: string) => Promise<void>;
  set_logos_bulk: (entries: Array<[string, string]>) => Promise<bigint>;
  get_logo_registry_size: () => Promise<bigint>;
}

// ============================================================================
// IDL Factory - defines the Candid interface for the frontend
// ============================================================================
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

  const SaveResult = IDL.Record({
    ok: IDL.Bool,
    timestamp: IDL.Int,
  });

  const DeleteResult = IDL.Record({
    ok: IDL.Bool,
  });

  return IDL.Service({
    // Profile methods
    get_profile: IDL.Func([], [IDL.Opt(UserProfile)], ['query']),
    upsert_profile: IDL.Func([IDL.Text, IDL.Text], [UserProfile], []),
    getCallerUserProfile: IDL.Func([], [IDL.Opt(UserProfile)], ['query']),
    saveCallerUserProfile: IDL.Func([UserProfile], [], []),
    initializeAccessControl: IDL.Func([], [], []),
    getCallerUserRole: IDL.Func([], [UserRole], ['query']),
    
    // Portfolio blob storage
    save_portfolio_blob: IDL.Func([IDL.Text], [SaveResult], []),
    load_portfolio_blob: IDL.Func([], [IDL.Opt(IDL.Text)], ['query']),
    get_portfolio_timestamp: IDL.Func([], [IDL.Opt(IDL.Int)], ['query']),
    delete_portfolio_blob: IDL.Func([], [DeleteResult], []),

    // Shared logo registry
    get_logo_registry: IDL.Func([], [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))], ['query']),
    set_logo: IDL.Func([IDL.Text, IDL.Text], [], []),
    set_logos_bulk: IDL.Func([IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))], [IDL.Nat], []),
    get_logo_registry_size: IDL.Func([], [IDL.Nat], ['query']),
  });
};

// ============================================================================
// Canister & Host Configuration
// ============================================================================

const IC_BACKEND_CANISTER_ID = 'ranje-7qaaa-aaaas-qdwxq-cai';
const LOCAL_BACKEND_CANISTER_ID = 'uxrrr-q7777-77774-qaaaq-cai';

function getBackendCanisterId(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_CANISTER_ID) {
    return import.meta.env.VITE_BACKEND_CANISTER_ID;
  }
  if (isOnIC()) return IC_BACKEND_CANISTER_ID;
  return LOCAL_BACKEND_CANISTER_ID;
}

/** Detect if running on IC (mainnet or custom domain pointed at IC) */
function isOnIC(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  // Direct canister URL
  if (h.endsWith('.ic0.app') || h.endsWith('.icp0.io')) return true;
  // Custom domain: not localhost and not local IP
  if (h !== 'localhost' && !h.startsWith('127.') && !h.endsWith('.localhost')) return true;
  return false;
}

function getHost(): string {
  if (isOnIC()) return 'https://icp-api.io';
  return 'http://127.0.0.1:4943';
}

// ============================================================================
// useActor Hook
// ============================================================================

export function useActor() {
  const { identity, principal } = useInternetIdentity();
  const [actor, setActor] = useState<BackendActor | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const actorRef = useRef<BackendActor | null>(null);

  useEffect(() => {
    const createActor = async () => {
      if (!identity || !principal || principal === '2vxsx-fae') {
        setActor(null);
        actorRef.current = null;
        return;
      }

      setIsFetching(true);
      setError(null);

      try {
        const host = getHost();
        const canisterId = getBackendCanisterId();
        
        console.log('[Actor] Creating actor:', { host, canisterId, principal: principal.slice(0, 12) + '...' });

        const agent = await HttpAgent.create({
          identity: identity as Identity,
          host,
        });

        if (host.includes('127.0.0.1') || host.includes('localhost')) {
          await agent.fetchRootKey();
        }

        const actorInstance = Actor.createActor<BackendActor>(idlFactory, {
          agent,
          canisterId,
        });

        // Auto-register user
        try {
          await actorInstance.initializeAccessControl();
        } catch (e) {
          // Expected if already initialized
        }

        setActor(actorInstance);
        actorRef.current = actorInstance;
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

  return { actor, actorRef, isFetching, error };
}
