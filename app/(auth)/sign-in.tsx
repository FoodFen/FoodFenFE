import Ionicons from '@expo/vector-icons/Ionicons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { isApiError } from '@/api/errors';
import { SocialSignInButtons } from '@/components/auth/SocialSignInButtons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { announceAndLeave } from '@/features/auth/announceAndLeave';
import { makeSignInSchema } from '@/features/auth/schemas';
import type { SignInValues } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/store';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { colorsFor } from '@/theme/colors';

export default function SignInScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const { t } = useTranslation();
  const { resolved } = useAppTheme();
  const colors = colorsFor(resolved);
  const schema = useMemo(() => makeSignInSchema(t), [t]);

  /** Errors that belong to the request rather than a single field. */
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await signIn(values);
      // Back to wherever this was opened from — Profile, normally. The root
      // layout's guard keys on the local profile, not on being signed in, so
      // nothing swaps the stack on our behalf.
      announceAndLeave(
        t('auth', 'signInSuccessTitle'),
        t('auth', 'signInSuccessMessage'),
        t('common', 'done'),
      );
    } catch (error) {
      if (isApiError(error)) {
        // Map field-level errors from the server onto the right inputs.
        if (error.fieldErrors) {
          for (const [field, message] of Object.entries(error.fieldErrors)) {
            if (field === 'email' || field === 'password') {
              setError(field, { message });
            }
          }
        }

        setFormError(
          error.kind === 'unauthorized'
            ? t('auth', 'invalidCredentials')
            : error.userMessage,
        );
      } else {
        setFormError(t('auth', 'genericError'));
      }
    }
  });

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: 24,
        paddingBottom: 32,
        paddingHorizontal: 24,
      }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View className="w-full max-w-md flex-1 self-center">
        <View className="items-center gap-3 pb-8 pt-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
            <Ionicons name="nutrition" size={32} color={colors.brand} />
          </View>
          <View className="items-center gap-1">
            <Text variant="title" className="text-3xl">
              {t('auth', 'welcomeBack')}
            </Text>
            <Text variant="body" tone="muted" className="text-center">
              {t('auth', 'signInSubtitle')}
            </Text>
          </View>
        </View>

        <View className="gap-4">
          <SocialSignInButtons
            onError={setFormError}
            onSuccess={() =>
              announceAndLeave(
                t('auth', 'signInSuccessTitle'),
                t('auth', 'signInSuccessMessage'),
                t('common', 'done'),
              )
            }
          />

          <Card className="gap-4">
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth', 'email')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth', 'password')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => void onSubmit()}
                />
              )}
            />

            {formError ? (
              <Text variant="caption" tone="danger">
                {formError}
              </Text>
            ) : null}

            <Button
              label={t('auth', 'signInTitle')}
              onPress={() => void onSubmit()}
              loading={isSubmitting}
              fullWidth
              size="lg"
            />
          </Card>
        </View>

        <View className="mt-auto flex-row justify-center gap-1 pt-8">
          <Text variant="body" tone="muted">
            {t('auth', 'newToApp')}
          </Text>
          <Link href="/sign-up" asChild>
            <Text variant="body" tone="brand" accessibilityRole="link">
              {t('auth', 'createAccountLink')}
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
