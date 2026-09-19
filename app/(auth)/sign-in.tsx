import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { isApiError } from '@/api/errors';
import { SocialSignInButtons } from '@/components/auth/SocialSignInButtons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { makeSignInSchema } from '@/features/auth/schemas';
import type { SignInValues } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/store';
import { useTranslation } from '@/hooks/useTranslation';

export default function SignInScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const { t } = useTranslation();
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
      if (router.canGoBack()) router.back();
      else router.replace('/');
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
      <View className="gap-2 pb-8">
        <Text className="text-5xl">🥗</Text>
        <Text variant="title">{t('auth', 'welcomeBack')}</Text>
        <Text variant="body" tone="muted">
          {t('auth', 'signInSubtitle')}
        </Text>
      </View>

      <View className="gap-4">
        <SocialSignInButtons onError={setFormError} />

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
          className="mt-2"
        />
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
    </KeyboardAwareScrollView>
  );
}
