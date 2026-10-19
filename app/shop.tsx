import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { Mascot } from '@/components/mascot/Mascot';
import { hasMascotArt, mascotArtId } from '@/components/mascot/visuals';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScrollScreen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import { useCoinBalance } from '@/features/dashboard/queries';
import { useCoinBundles, useRedeemCoins } from '@/features/gamification/queries';
import {
  isInsufficientCoins,
  useEquipMascot,
  useEquippedMascotId,
  useMascotCatalog,
  usePurchaseMascot,
} from '@/features/mascot/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { env } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

/** Spend earned coins for Premium days — the counterpart to the PayOS `app/premium` flow. */
export default function ShopScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { data: balance = 0 } = useCoinBalance();
  const redeem = useRedeemCoins();
  const { data: bundleData, isError, fetchStatus, refetch } = useCoinBundles();
  const bundles = bundleData?.bundles ?? [];
  const loadingBundles = bundles.length === 0 && fetchStatus === 'fetching';
  const bundlesFailed = !loadingBundles && (isError || bundles.length === 0);

  const showMascots = useAuthStore((state) => state.session !== null) && env.hasBackend;
  const catalog = useMascotCatalog();
  const purchase = usePurchaseMascot();
  const equip = useEquipMascot();
  const equippedId = useEquippedMascotId();
  const mascots = (catalog.data?.mascots ?? []).filter((mascot) => hasMascotArt(mascot.id));
  const loadingMascots = !catalog.data && catalog.fetchStatus === 'fetching';
  const mascotsFailed = !loadingMascots && (catalog.isError || !catalog.data);
  const refetchCatalog = catalog.refetch;
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (showMascots) void refetchCatalog();
  }, [showMascots, refetchCatalog]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), showMascots ? refetchCatalog() : null]);
    setRefreshing(false);
  };

  const confirmBuy = (id: string, name: string, coinCost: number) => {
    if (balance < coinCost) {
      Alert.alert(t('shop', 'insufficientCoins'));
      return;
    }

    haptics.selection();
    Alert.alert(
      t('shop', 'buyConfirmTitle').replace('{name}', name),
      t('shop', 'buyConfirmMessage').replace('{cost}', String(coinCost)),
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('shop', 'buyButton'),
          onPress: () => {
            purchase.mutate(id, {
              onSuccess: () => haptics.success(),
              onError: (error) => {
                if (isApiError(error) && error.code === 'mascot_already_owned') return;

                haptics.error();
                Alert.alert(
                  isInsufficientCoins(error)
                    ? t('shop', 'insufficientCoins')
                    : t('common', 'somethingWentWrong'),
                );
              },
            });
          },
        },
      ],
    );
  };

  const confirmRedeem = (days: number, coinCost: number) => {
    if (balance < coinCost) {
      Alert.alert(t('shop', 'insufficientCoins'));
      return;
    }

    haptics.selection();
    Alert.alert(
      t('shop', 'redeemConfirmTitle').replace('{days}', String(days)),
      t('shop', 'redeemConfirmMessage').replace('{cost}', String(coinCost)),
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('shop', 'redeemButton'),
          onPress: () => {
            redeem.mutate(days, {
              onSuccess: () => {
                haptics.success();
                router.push('/premium/welcome');
              },
              onError: (error) => {
                haptics.error();
                Alert.alert(
                  isApiError(error) && error.status === 409
                    ? t('shop', 'insufficientCoins')
                    : t('common', 'somethingWentWrong'),
                );
              },
            });
          },
        },
      ],
    );
  };

  return (
    <ScrollScreen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={colors.fgMuted}
        />
      }
    >
      <Stack.Screen options={{ title: t('shop', 'title') }} />

      <Card className="flex-row items-center justify-between">
        <Text variant="body" tone="muted">
          {t('shop', 'balanceLabel')}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="sparkles" size={18} color={colors.warning} />
          <Text variant="heading">{balance.toLocaleString()}</Text>
        </View>
      </Card>

      <Text variant="label" tone="muted">
        {t('shop', 'premiumBundlesHeading')}
      </Text>

      {loadingBundles ? (
        <>
          <Skeleton className="h-[76px]" />
          <Skeleton className="h-[76px]" />
        </>
      ) : null}

      {bundlesFailed ? (
        <View className="items-center gap-2">
          <Text variant="body" tone="muted" className="text-center">
            {t('shop', 'bundlesError')}
          </Text>
          <Button
            label={t('common', 'retry')}
            variant="secondary"
            size="sm"
            onPress={() => void refetch()}
          />
        </View>
      ) : null}

      {bundles.map((bundle) => {
        const affordable = balance >= bundle.coinCost;

        return (
          <Card key={bundle.id} className="flex-row items-center justify-between gap-3">
            <View className="gap-0.5">
              <Text variant="label">
                {t('shop', 'bundleTitle').replace('{days}', String(bundle.days))}
              </Text>
              <Text variant="caption" tone="muted">
                {t('shop', 'bundleCost').replace('{cost}', String(bundle.coinCost))}
              </Text>
            </View>

            <Button
              label={t('shop', 'redeemButton')}
              onPress={() => confirmRedeem(bundle.days, bundle.coinCost)}
              disabled={!affordable || redeem.isPending}
              size="sm"
            />
          </Card>
        );
      })}

      {showMascots ? (
        <>
          <Text variant="label" tone="muted">
            {t('shop', 'mascotsHeading')}
          </Text>

          {loadingMascots ? (
            <>
              <Skeleton className="h-[88px]" />
              <Skeleton className="h-[88px]" />
            </>
          ) : null}

          {mascotsFailed ? (
            <View className="items-center gap-2">
              <Text variant="body" tone="muted" className="text-center">
                {t('shop', 'mascotsError')}
              </Text>
              <Button
                label={t('common', 'retry')}
                variant="secondary"
                size="sm"
                onPress={() => void refetchCatalog()}
              />
            </View>
          ) : null}

          {mascots.map((mascot) => (
            <Card key={mascot.id} className="flex-row items-center gap-3">
              <Mascot mascotId={mascotArtId(mascot.id)} action="idle" size={56} />
              <View className="flex-1 gap-0.5">
                <Text variant="label">{mascot.name}</Text>
                {mascot.owned ? null : (
                  <Text variant="caption" tone="muted">
                    {t('shop', 'bundleCost').replace('{cost}', String(mascot.coinCost))}
                  </Text>
                )}
              </View>

              {!mascot.owned ? (
                <Button
                  label={t('shop', 'buyButton')}
                  onPress={() => confirmBuy(mascot.id, mascot.name, mascot.coinCost)}
                  disabled={purchase.isPending}
                  size="sm"
                />
              ) : mascot.id === equippedId ? (
                <Button label={t('shop', 'equippedLabel')} disabled size="sm" />
              ) : (
                <Button
                  label={t('shop', 'equipButton')}
                  variant="secondary"
                  onPress={() => {
                    haptics.selection();
                    equip(mascot.id);
                  }}
                  size="sm"
                />
              )}
            </Card>
          ))}
        </>
      ) : null}
    </ScrollScreen>
  );
}
