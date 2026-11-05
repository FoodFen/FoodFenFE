import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { loadCatalogOverlay, syncCatalog } from '@/data/catalogSync';
import { queryKeys } from '@/lib/queryClient';

/**
 * Loads the synced-food overlay once migrations are done, then syncs the
 * catalog on mount and on every return to the foreground (`syncCatalog`
 * throttles itself). Fire-and-forget: nothing waits on the network, and a
 * failure is dropped so the next trigger retries. Runs for guests too. A sync
 * that wrote rows invalidates the catalog queries so an open search re-runs.
 */
export function useCatalogSync(migrated: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!migrated) return;

    const refreshSearch = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.all });

    loadCatalogOverlay();
    refreshSearch();

    const trySync = () => {
      syncCatalog()
        .then((wrote) => {
          if (wrote) refreshSearch();
        })
        .catch(() => undefined);
    };

    trySync();

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') trySync();
    });

    return () => subscription.remove();
  }, [migrated, queryClient]);
}
