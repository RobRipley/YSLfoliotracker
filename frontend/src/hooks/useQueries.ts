import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from './useActor';
import { getStore, resetStore, addHolding as addHoldingToStore, type Store } from '@/lib/dataModel';
import { saveStore, loadStore, clearPersistedData } from '@/lib/persistence';
import { useEffect } from 'react';
import type { UserProfile } from '@/backend';

// Initialize store on module load from persisted data only
const persistedStore = loadStore();
if (persistedStore) {
  // Restore persisted data
  const store = getStore();
  Object.assign(store, persistedStore);
}

export function usePortfolioData() {
  const { actor } = useActor();

  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const store = getStore();
      return store;
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
}

export function useIsMockDataActive() {
  // Mock data is never active since we removed initialization
  return false;
}

export function useClearMockData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      resetStore();
      clearPersistedData();
      saveStore(getStore());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

export function useAddHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      symbol: string;
      tokensOwned: number;
      avgCost?: number;
      purchaseDate?: number;
      notes?: string;
    }) => {
      const holding = addHoldingToStore(data.symbol, data.tokensOwned, {
        avgCost: data.avgCost,
        purchaseDate: data.purchaseDate,
        notes: data.notes,
      });
      
      // Persist changes
      saveStore(getStore());
      
      return holding;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

// Hook to listen for import events
export function useImportListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleImportStore = (event: CustomEvent<Store>) => {
      const store = getStore();
      Object.assign(store, event.detail);
      saveStore(store);
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    };

    const handleImportHoldings = (event: CustomEvent<any[]>) => {
      const store = getStore();
      // Merge imported holdings
      event.detail.forEach((holding: any) => {
        addHoldingToStore(holding.symbol, holding.tokensOwned, {
          avgCost: holding.avgCost,
          purchaseDate: holding.purchaseDate,
          notes: holding.notes,
        });
      });
      saveStore(store);
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    };

    window.addEventListener('importStore', handleImportStore as EventListener);
    window.addEventListener('importHoldings', handleImportHoldings as EventListener);

    return () => {
      window.removeEventListener('importStore', handleImportStore as EventListener);
      window.removeEventListener('importHoldings', handleImportHoldings as EventListener);
    };
  }, [queryClient]);
}

// Hook to auto-save on data changes
export function useAutoSave() {
  const { data: portfolio } = usePortfolioData();

  useEffect(() => {
    if (portfolio) {
      saveStore(portfolio);
    }
  }, [portfolio]);
}

// User Profile Queries
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      if (!actor) throw new Error('Actor not available');
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  // Return custom state that properly reflects actor dependency
  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: { name: string; email?: string }) => {
      if (!actor) throw new Error('Actor not available');
      
      const userProfile: UserProfile = {
        name: profile.name,
        email: profile.email,
        createdAt: BigInt(Date.now() * 1_000_000), // Convert to nanoseconds
      };
      
      await actor.saveCallerUserProfile(userProfile);
      return userProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    },
  });
}
