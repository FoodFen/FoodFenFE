import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { isApiError } from '@/api/errors';
import type { PaymentProvider, RemoteCheckoutResponse } from '@/api/schemas';
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
  usePaymentPlans,
  usePaymentStatus,
  useRefreshSubscription,
} from '@/features/premium/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/cn';
import { env } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';
import type { PlanType } from '@/types/models';

type Stage = 'idle' | 'checking-out' | 'awaiting-payment' | 'error';

// Must match the backend's MOMO_REDIRECT_URL so the in-app browser closes itself on return.
const RETURN_URL = 'foodfen://premium/return';

const METHOD_LABEL = { payos: 'methodPayos', momo: 'methodMomo' } as const;
const PAY_LABEL = { payos: 'subscribeButton', momo: 'payWithMomo' } as const;

/** The provider's app if the order has a deeplink that opens, otherwise its web checkout, which redirects back to RETURN_URL. */
async function openCheckout(order: RemoteCheckoutResponse) {
  const opened = order.deeplink
    ? await Linking.openURL(order.deeplink).then(
        () => true,
        () => false,
      )
    : false;

  if (!opened) await WebBrowser.openAuthSessionAsync(order.checkoutUrl, RETURN_URL).catch(() => {});
}

/**
 * Checkout for the plan chosen on the Premium popup, through PayOS or MoMo.
 *
 * Neither is native IAP (see `docs/backend-contracts/premium-entitlements.md`).
 * PayOS renders the checkout's VietQR `qrCode` inline; MoMo hands off to the
 * MoMo app. Either way the gateway confirms payment to our backend via a
 * webhook, never to the client, so this screen polls until the status leaves
 * "pending" — and, while mounted, it alone navigates to the welcome screen.
 */
export default function PremiumPaymentScreen() {
  const { plan, label, price, period } = useLocalSearchParams<{
    plan: string;
    label: string;
    price: string;
    period: string;
  }>();
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const session = useAuthStore((state) => state.session);
  const available = canUseRemote();
  // The one `canUseRemote()` reason worth its own affordance: everything else
  // about the build/connection is fine, only signing in is missing (mirrors
  // `app/chat.tsx`'s gating) — redeeming a purchase requires a FoodFend
  // account so it follows the account, not the device.
  const isNoSessionReason = env.hasBackend && onlineManager.isOnline() && !session;

  const { data: planData } = usePaymentPlans();
  const providers: PaymentProvider[] = planData?.providers ?? ['payos'];
  const [chosenProvider, setChosenProvider] = useState<PaymentProvider | null>(null);
  const provider =
    chosenProvider && providers.includes(chosenProvider)
      ? chosenProvider
      : (providers[0] ?? 'payos');

  const [stage, setStage] = useState<Stage>('idle');
  const [order, setOrder] = useState<RemoteCheckoutResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Guards against handling the same "left pending" status twice — the
  // status query can re-render after its effect already fired.
  const handledStatusRef = useRef(false);

  const checkout = useCheckout();
  const cancelPayment = useCancelPayment();
  const refreshSubscription = useRefreshSubscription();
  const paymentStatus = usePaymentStatus(order?.orderCode ?? null, {
    enabled: stage === 'awaiting-payment',
  });

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
        router.dismissAll();
        router.replace('/premium/welcome');
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
      const result = await checkout.mutateAsync({ planType, provider });

      setOrder(result);
      setStage('awaiting-payment');
      if (result.provider === 'momo' || !result.qrCode) void openCheckout(result);
    } catch (error) {
      setStage('error');
      setErrorMessage(isApiError(error) ? error.userMessage : t('common', 'somethingWentWrong'));
    }
  };

  const onCancelCheckout = () => {
    if (order) cancelPayment.mutate({ orderCode: order.orderCode });

    setStage('idle');
    setOrder(null);
    handledStatusRef.current = false;
  };

  const onRetry = () => {
    setStage('idle');
    setOrder(null);
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
            icon="lock-closed-outline"
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

  const isMomo = order?.provider === 'momo';

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

        {stage === 'awaiting-payment' && order && !pollFailed ? (
          <Card className="items-center gap-3 py-6">
            {order.qrCode ? (
              <View className="rounded-card bg-white p-3">
                <QRCode value={order.qrCode} size={220} />
              </View>
            ) : null}
            <Text variant="heading" className="text-center">
              {t('premiumPayment', isMomo ? 'momoWaitingTitle' : 'waitingTitle')}
            </Text>
            <Text variant="body" tone="muted" className="text-center">
              {t('premiumPayment', isMomo ? 'momoWaitingDescription' : 'waitingDescription')}
            </Text>
            {!order.qrCode ? (
              <Button
                label={t('premiumPayment', isMomo ? 'openMomoAgain' : 'openCheckoutAgain')}
                onPress={() => void openCheckout(order)}
                size="sm"
              />
            ) : null}
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
            {providers.length > 1 ? (
              <View className="gap-2">
                <Text variant="caption" tone="muted">
                  {t('premiumPayment', 'methodTitle')}
                </Text>
                {providers.map((option) => {
                  const isSelected = option === provider;

                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        haptics.selection();
                        setChosenProvider(option);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      className={cn(
                        'flex-row items-center justify-between rounded-card border-2 bg-surface p-4',
                        isSelected ? 'border-brand' : 'border-border',
                      )}
                    >
                      <Text variant="label">{t('premiumPayment', METHOD_LABEL[option])}</Text>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={isSelected ? colors.brand : colors.fgSubtle}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <Button
              label={t('premiumPayment', PAY_LABEL[provider])}
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
