import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { userErrorMessage } from '@/api/errors';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/features/auth/store';
import { isAiQuotaSpent } from '@/features/diary/aiQuota';
import { useAiQuota, useBarcodeLookup } from '@/features/diary/queries';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { env } from '@/lib/env';
import { haptics } from '@/lib/haptics';
import { colorsFor } from '@/theme/colors';

/**
 * Live camera for the log flow: a barcode in frame is looked up and offered as
 * a floating card that opens the portion step; the shutter photographs a meal
 * and hands the picture to the AI image mode in `app/log/manual.tsx`.
 *
 * `onBarcodeScanned` fires many times a second, so a code is only acted on
 * when it differs from the last one seen. Scanning works regardless of AI
 * quota; only the shutter is blocked once the image quota is spent.
 */

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export default function CameraScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const [permission, requestPermission] = useCameraPermissions();

  const camera = useRef<CameraView>(null);
  const lastCode = useRef<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [taking, setTaking] = useState(false);

  const lookup = useBarcodeLookup(code);
  const food = lookup.data;

  useEffect(() => {
    if (food) haptics.selection();
  }, [food]);

  const aiAvailable = env.hasBackend && onlineManager.isOnline();
  const signedIn = useAuthStore((state) => state.session !== null);
  const quota = useAiQuota(aiAvailable, signedIn).data;
  const imageLimited = isAiQuotaSpent(quota, 'image');

  const shoot = async () => {
    if (taking) return;
    if (imageLimited) {
      router.push('/premium');
      return;
    }

    setTaking(true);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.7 });
      if (photo) {
        router.dismissTo({
          pathname: '/log/manual',
          params: { mode: 'image', imageUri: photo.uri },
        });
      }
    } catch (error) {
      haptics.error();
      Alert.alert(
        t('logCamera', 'captureErrorTitle'),
        userErrorMessage(error, t('logManual', 'aiErrorFallback')),
      );
    } finally {
      setTaking(false);
    }
  };

  if (!permission) return <View className="flex-1 bg-black" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-bg">
        <ScreenHeader
          title={t('logCamera', 'permissionTitle')}
          icon="close"
          onPress={() => router.back()}
          accessibilityLabel={t('common', 'cancel')}
        />
        <View className="flex-1 justify-center">
          <EmptyState
            icon="camera-outline"
            title={t('logCamera', 'permissionTitle')}
            description={t('logCamera', 'permissionDescription')}
            actionLabel={t('logCamera', 'permissionAction')}
            onAction={() => void requestPermission()}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={camera}
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={({ data }) => {
          if (data === lastCode.current) return;
          lastCode.current = data;
          setCode(data);
        }}
      />

      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('common', 'cancel')}
        hitSlop={8}
        style={{ top: insets.top + 8 }}
        className="absolute left-4 h-10 w-10 items-center justify-center rounded-full bg-black/50 active:opacity-70"
      >
        <Ionicons name="close" size={22} color="#FFFFFF" />
      </Pressable>

      <View
        style={{ paddingBottom: insets.bottom + 24 }}
        className="absolute inset-x-0 bottom-0 items-center gap-5 px-4"
      >
        {!code ? (
          <View className="rounded-pill bg-black/50 px-4 py-2">
            <Text variant="caption" className="text-center text-white">
              {t('logCamera', 'hint')}
            </Text>
          </View>
        ) : lookup.isLoading ? (
          <View className="flex-row items-center gap-3 self-stretch rounded-card border border-border bg-surface px-4 py-3">
            <ActivityIndicator size="small" />
            <Text variant="body" tone="muted">
              {t('logCamera', 'lookingUp')}
            </Text>
          </View>
        ) : lookup.isError ? (
          <Pressable
            onPress={() => void lookup.refetch()}
            accessibilityRole="button"
            className="flex-row items-center gap-3 self-stretch rounded-card border border-border bg-surface px-4 py-3 active:bg-surface-alt"
          >
            <Text variant="body" tone="danger" className="flex-1">
              {userErrorMessage(lookup.error, t('logCamera', 'lookupError'))}
            </Text>
            <Ionicons name="refresh" size={18} color={colors.fgSubtle} />
          </Pressable>
        ) : food ? (
          <Pressable
            onPress={() =>
              router.replace({ pathname: '/log/search', params: { foodId: food.id } })
            }
            accessibilityRole="button"
            accessibilityLabel={t('logCamera', 'detectedA11y').replace(
              '{name}',
              food.name,
            )}
            className="flex-row items-center gap-3 self-stretch rounded-card border border-border bg-surface px-4 py-3 active:bg-surface-alt"
          >
            <View className="flex-1 gap-0.5">
              <Text variant="caption" tone="brand">
                {t('logCamera', 'detected')}
              </Text>
              <Text variant="heading" numberOfLines={2}>
                {food.name}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.fgSubtle} />
          </Pressable>
        ) : (
          <View className="self-stretch rounded-card border border-border bg-surface px-4 py-3">
            <Text variant="body" tone="muted">
              {t('logCamera', 'notFound')}
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => void shoot()}
          disabled={taking}
          accessibilityRole="button"
          accessibilityLabel={t('logCamera', 'shutterA11y')}
          accessibilityState={{ disabled: taking }}
          className="h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white active:opacity-70"
        >
          <View className="h-14 w-14 rounded-full bg-white" />
        </Pressable>
      </View>
    </View>
  );
}
