import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { Alert, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScrollScreen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useCoinBalance } from '@/features/dashboard/queries';
import { useCoinBundles, useRedeemCoins } from '@/features/gamification/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

/** Spend earned coins for Premium days — the counterpart to the PayOS `app/premium` flow. */
export default function ShopScreen() {
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const { data: balance = 0 } = useCoinBalance();
  const redeem = useRedeemCoins();
  const { data: bundleData, isPending, fetchStatus } = useCoinBundles();

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
    <ScrollScreen>
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

      {bundleData?.bundles.map((bundle) => {
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

      {bundleData ? null : (
        <Text variant="body" tone="muted">
          {isPending && fetchStatus === 'fetching'
            ? t('shop', 'loading')
            : t('shop', 'needsConnection')}
        </Text>
      )}
    </ScrollScreen>
  );
}
