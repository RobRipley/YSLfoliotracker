import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor, type UserProfile } from './useActor';
import { useInternetIdentity } from './useInternetIdentity';
import { getStore, resetStore, addHolding as addHoldingToStore, type Store } from '@/lib/dataModel';
import { saveStore, loadStore, clearPersistedData, setPrincipal } from '@/lib/persistence';
import { useEffect } from 'react';

export function usePortfolioData() {
  const { principal } = useInternetIdentity();
  
  // Set principal for storage isolation
  useEffect(() => {
    setPrincipal(principal);
  }, [principal]);

  return useQuery({
    queryKey: ['portfolio', principal],
    queryFn: async () => {
      const store = getStore();
      return store;
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    enabled: !!principal && principal !== '2vxsx-fae',
  });
}

export function useIsMockDataActive() {
  // Mock data is never active since we removed initialization
  return false;
}

export function useClearMockData() {
  const queryClient = useQueryClient();
  const { principal } = useInternetIdentity();

  return useMutation({
    mutationFn: async () => {
      resetStore();
      clearPersistedData();
      saveStore(getStore());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', principal] });
    },
  });
}

export function useAddHolding() {
  const queryClient = useQueryClient();
  const { principal } = useInternetIdentity();

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
      queryClient.invalidateQueries({ queryKey: ['portfolio', principal] });
    },
  });
}

// Hook to listen for import events
export function useImportListener() {
  const queryClient = useQueryClient();
  const { principal } = useInternetIdentity();

  useEffect(() => {
    const handleImportStore = (event: CustomEvent<Store>) => {
      const store = getStore();
      Object.assign(store, event.detail);
      saveStore(store);
      queryClient.invalidateQueries({ queryKey: ['portfolio', principal] });
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
      queryClient.invalidateQueries({ queryKey: ['portfolio', principal] });
    };

    window.addEventListener('importStore', handleImportStore as EventListener);
    window.addEventListener('importHoldings', handleImportHoldings as EventListener);

    return () => {
      window.removeEventListener('importStore', handleImportStore as EventListener);
      window.removeEventListener('importHoldings', handleImportHoldings as EventListener);
    };
  }, [queryClient, principal]);
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
      const result = await actor.get_profile();
      // Handle the [] | [UserProfile] response
      if (result && result.length > 0) {
        return result[0];
      }
      return null;
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
    mutationFn: async (profile: { firstName: string; lastName: string }) => {
      if (!actor) throw new Error('Actor not available');
      
      const updatedProfile = await actor.upsert_profile(profile.firstName, profile.lastName);
      return updatedProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUserProfile'] });
    },
  });
}

// Re-export UserProfile type
export type { UserProfile };
