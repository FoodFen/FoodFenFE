import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { mascotsApi } from '@/api/endpoints/mascots';
import { ApiError, isApiError } from '@/api/errors';
import type { RemoteMascotCatalog } from '@/api/schemas';
import { getCoinBalance, reconcileCoinBalance } from '@/data/gamificationRepository';
import { useAuthStore } from '@/features/auth/store';
import { DEFAULT_MASCOT_ID, useMascotEquipStore } from '@/features/mascot/equippedStore';
import { useProfileStore } from '@/features/profile/store';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/queryClient';

/**
 * Server-owned mascot catalogue, purchase and equip. Nothing here is awaited
 * by the UI: the catalogue is a background pull, and an equip switches on
 * device at once with the PUT fired behind it (`pendingEquipId` keeps it
 * alive across a failed or offline send until the next pull retries it).
 */

function useUserId(): string | null {
  return useProfileStore((state) => state.profile?.id ?? null);
}

function useAccountId(): number | undefined {
  return useAuthStore((state) => state.session?.user.id);
}

/** A response landing after the account changed belongs to the previous account. */
async function forCurrentAccount<T>(run: () => Promise<T>): Promise<T> {
  const accountId = useAuthStore.getState().session?.user.id;
  const value = await run();

  if (useAuthStore.getState().session?.user.id !== accountId) {
    throw new ApiError('canceled', 'The session changed during the request.');
  }

  return value;
}

/** 409 on purchase without a mascot code — the server's, or the local pre-check's, "not enough coins". */
export function isInsufficientCoins(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.status === 409 &&
    error.code !== 'mascot_already_owned' &&
    error.code !== 'mascot_not_owned'
  );
}

function sendEquip(id: string, onRejected: () => void): void {
  mascotsApi.equip(id).then(
    () => useMascotEquipStore.getState().settle(id),
    (error: unknown) => {
      if (isApiError(error) && (error.status === 404 || error.status === 409)) {
        onRejected();
      }
    },
  );
}

function applyCatalog(
  queryClient: QueryClient,
  userId: string | null,
  catalog: RemoteMascotCatalog,
): void {
  if (userId) reconcileCoinBalance(userId, catalog.balance);
  void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.coins() });

  const store = useMascotEquipStore.getState();
  const pending = store.pendingEquipId;

  if (pending === null) store.adopt(catalog.equippedId);
  else if (pending === catalog.equippedId) store.settle(pending);
  else sendEquip(pending, () => store.settle(pending, catalog.equippedId));
}

/** Mounted in the tabs layout; screens read the same query for the shop. */
export function useMascotCatalog() {
  const userId = useUserId();
  const accountId = useAccountId();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.mascots.catalog(accountId),
    queryFn: async ({ signal }) => {
      const catalog = await forCurrentAccount(() => mascotsApi.list(signal));

      applyCatalog(queryClient, userId, catalog);

      return catalog;
    },
    enabled: accountId !== undefined && env.hasBackend,
    staleTime: 30_000,
    networkMode: 'always',
    retry: false,
  });
}

export function usePurchaseMascot() {
  const userId = useUserId();
  const accountId = useAccountId();
  const queryClient = useQueryClient();
  const catalogKey = queryKeys.mascots.catalog(accountId);

  return useMutation({
    mutationFn: (id: string) => {
      const cost = queryClient
        .getQueryData<RemoteMascotCatalog>(catalogKey)
        ?.mascots.find((mascot) => mascot.id === id)?.coinCost;

      if (userId && cost !== undefined && getCoinBalance(userId) < cost) {
        throw new ApiError('unknown', 'Not enough coins.', { status: 409 });
      }

      return forCurrentAccount(() => mascotsApi.purchase(id));
    },
    onSuccess: (catalog) => {
      queryClient.setQueryData(catalogKey, catalog);
      applyCatalog(queryClient, userId, catalog);
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'mascot_already_owned') {
        void queryClient.invalidateQueries({ queryKey: catalogKey });
      }
    },
  });
}

export function useEquipMascot() {
  const accountId = useAccountId();
  const queryClient = useQueryClient();

  return (id: string): void => {
    if (accountId === undefined || !env.hasBackend) return;

    useMascotEquipStore.getState().equip(id);
    sendEquip(id, () => {
      useMascotEquipStore.getState().settle(id);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.mascots.catalog(accountId),
      });
    });
  };
}

export function useEquippedMascotId(): string {
  const signedIn = useAuthStore((state) => state.session !== null);
  const equippedId = useMascotEquipStore((state) => state.equippedId);

  return signedIn ? equippedId : DEFAULT_MASCOT_ID;
}
