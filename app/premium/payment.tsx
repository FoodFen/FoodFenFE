import { onlineManager } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { isApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { canUseRemote } from '@/data/sync';
import { useAuthStore } from '@/features/auth/store';
import {
  useCancelPayment,
  useCheckout,
  usePaymentStatus,
  useRefreshSubscription,
} from '@/features/premium/queries';
import { useTranslation } from '@/hooks/useTranslation';
import { env } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import type { PlanType } from '@/types/models';

type Stage = 'idle' | 'checking-out' | 'awaiting-payment' | 'error';

/**
 * PayOS checkout for the plan chosen on the Premium popup.
 *
 * There's no card form here — PayOS is a hosted bank-transfer/VietQR
 * checkout, not native IAP (see `docs/backend-contracts/
 * premium-entitlements.md`). Rather than sending the user to PayOS's hosted
 * page, this screen renders the checkout's `qrCode` (a VietQR string) inline
 * and polls for the result: PayOS confirms payment to our backend via a
 * webhook, never to the client directly, so the QR staying on screen only
 * means the user hasn't paid yet, not that anything failed.
 */
export default function PremiumPaymentScreen() {
  const { plan, label, price, period } = useLocalSearchParams<{
    plan: string;
    label: string;
    price: string;
    period: string;
  }>();
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const available = canUseRemote();
  // The one `canUseRemote()` reason worth its own affordance: everything else
  // about the build/connection is fine, only signing in is missing (mirrors
  // `app/chat.tsx`'s gating) — redeeming a purchase requires a FoodFend
  // account so it follows the account, not the device.
  const isNoSessionReason = env.hasBackend && onlineManager.isOnline() && !session;

  const [stage, setStage] = useState<Stage>('idle');
  const [orderCode, setOrderCode] = useState<number | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Guards against handling the same "left pending" status twice — the
  // status query can re-render after its effect already fired.
  const handledStatusRef = useRef(false);

  const checkout = useCheckout();
  const cancelPayment = useCancelPayment();
  const refreshSubscription = useRefreshSubscription();
  const paymentStatus = usePaymentStatus(orderCode, { enabled: stage === 'awaiting-payment' });

  // A non-"paid" terminal status is rendered straight from the query below
  // (`pollFailed`) rather than copied into `stage` here — only the "paid"
  // case needs an effect at all, to call the external `refreshSubscription`
  // mutation exactly once per checkout.
  useEffect(() => {
    if (paymentStatus.data?.status !== 'paid' || handledStatusRef.current) return;

    handledStatusRef.current = true;

    refreshSubscription.mutate(undefined, {
      onSuccess: () => {
        haptics.success();
        Alert.alert(
          t('premiumPayment', 'successTitle'),
          t('premiumPayment', 'successMessage'),
          [{ text: t('common', 'done'), onPress: () => router.dismiss() }],
        );
      },
      onError: () => {
        setStage('error');
        setErrorMessage(t('common', 'somethingWentWrong'));
      },
    });
  }, [paymentStatus.data?.status, refreshSubscription, t]);

  const pollFailed =
    stage === 'awaiting-payment' &&
    paymentStatus.data !== undefined &&
    paymentStatus.data.status !== 'pending' &&
    paymentStatus.data.status !== 'paid';

  const onPressCheckout = async () => {
    setErrorMessage(null);
    setStage('checking-out');
    handledStatusRef.current = false;

    try {
      const planType: PlanType = plan === 'yearly' ? 'annual' : 'monthly';
      const result = await checkout.mutateAsync(planType);

      setOrderCode(result.orderCode);
      setQrCode(result.qrCode);
      setStage('awaiting-payment');
    } catch (error) {
      setStage('error');
      setErrorMessage(isApiError(error) ? error.userMessage : t('common', 'somethingWentWrong'));
    }
  };

  const onCancelCheckout = () => {
    if (orderCode !== null) cancelPayment.mutate({ orderCode });

    setStage('idle');
    setOrderCode(null);
    setQrCode(null);
    handledStatusRef.current = false;
  };

  const onRetry = () => {
    setStage('idle');
    setOrderCode(null);
    setQrCode(null);
    setErrorMessage(null);
    handledStatusRef.current = false;
  };

  if (!available) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader
          title={t('premiumPayment', 'layoutTitle')}
          icon="arrow-back"
          onPress={() => router.back()}
          accessibilityLabel={t('common', 'back')}
        />
        {isNoSessionReason ? (
          <EmptyState
            icon="🔒"
            title={t('premiumPayment', 'unavailableTitle')}
            description={t('premiumPayment', 'unavailableDescription')}
            actionLabel={t('premiumPayment', 'signIn')}
            onAction={() => router.push('/sign-in')}
          />
        ) : (
          <ErrorState
            title={t('premiumPayment', 'unavailableTitle')}
            description={t('premiumPayment', 'unavailableDescription')}
          />
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader
        title={t('premiumPayment', 'layoutTitle')}
        icon="arrow-back"
        onPress={() => router.back()}
        accessibilityLabel={t('common', 'back')}
      />

      <View className="flex-1 gap-4 p-4">
        <Card className="gap-2">
          <Text variant="caption" tone="muted">
            {t('premiumPayment', 'orderSummary')}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text variant="label">{label}</Text>
            <Text variant="label">
              {price}
              {period}
            </Text>
          </View>
          <View className="flex-row items-center justify-between border-t border-border pt-2">
            <Text variant="body" tone="muted">
              {t('premiumPayment', 'totalToday')}
            </Text>
            <Text variant="heading">{price}</Text>
          </View>
        </Card>

        {stage === 'awaiting-payment' && !pollFailed ? (
          <Card className="items-center gap-3 py-6">
            {qrCode ? (
              <View className="rounded-card bg-white p-3">
                <QRCode value={qrCode} size={220} />
              </View>
            ) : (
              <ActivityIndicator />
            )}
            <Text variant="heading" className="text-center">
              {t('premiumPayment', 'waitingTitle')}
            </Text>
            <Text variant="body" tone="muted" className="text-center">
              {t('premiumPayment', 'waitingDescription')}
            </Text>
            <View className="flex-row gap-3 pt-2">
              <Button
                label={t('premiumPayment', 'checkStatus')}
                variant="secondary"
                size="sm"
                onPress={() => void paymentStatus.refetch()}
              />
              <Button
                label={t('common', 'cancel')}
                variant="ghost"
                size="sm"
                onPress={onCancelCheckout}
              />
            </View>
          </Card>
        ) : stage === 'error' || pollFailed ? (
          <ErrorState
            description={errorMessage ?? t('premiumPayment', 'checkoutFailed')}
            onRetry={onRetry}
          />
        ) : (
          <>
            <Button
              label={t('premiumPayment', 'subscribeButton')}
              onPress={() => void onPressCheckout()}
              loading={stage === 'checking-out'}
              fullWidth
              size="lg"
            />
            <Text variant="caption" tone="subtle" className="text-center">
              {t('premiumPayment', 'terms')}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
