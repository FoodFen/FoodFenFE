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
import { makeSignUpSchema } from '@/features/auth/schemas';
import type { SignUpValues } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/store';
import { useTranslation } from '@/hooks/useTranslation';

export default function SignUpScreen() {
  const signUp = useAuthStore((state) => state.signUp);
  const [formError, setFormError] = useState<string | null>(null);
  const { t } = useTranslation();
  const schema = useMemo(() => makeSignUpSchema(t), [t]);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await signUp({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
      });

      // Back to wherever this was opened from — Profile, normally. The root
      // layout's guard keys on the local profile, not on being signed in, so
      // nothing swaps the stack on our behalf.
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (error) {
      if (isApiError(error)) {
        if (error.fieldErrors?.email) {
          setError('email', { message: error.fieldErrors.email });
        }

        setFormError(error.userMessage);
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
      <View className="gap-2 pb-6">
        <Text variant="title">{t('auth', 'createYourAccount')}</Text>
        <Text variant="body" tone="muted">
          {t('auth', 'signUpSubtitle')}
        </Text>
      </View>

      <View className="gap-4">
        <SocialSignInButtons
          onError={setFormError}
          onSuccess={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
        />

        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('common', 'name')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.displayName?.message}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          )}
        />

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
              hint={t('auth', 'passwordHint')}
              secureTextEntry
              // `newPassword` is what prompts the OS to offer a strong password
              // and save it to the keychain.
              autoComplete="new-password"
              textContentType="newPassword"
            />
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={t('auth', 'confirmPassword')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword?.message}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
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
          label={t('auth', 'createAccountTitle')}
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          fullWidth
          size="lg"
          className="mt-2"
        />
      </View>

      <View className="mt-auto flex-row justify-center gap-1 pt-8">
        <Text variant="body" tone="muted">
          {t('auth', 'alreadyHaveAccount')}
        </Text>
        <Link href="/sign-in" asChild>
          <Text variant="body" tone="brand" accessibilityRole="link">
            {t('auth', 'signInTitle')}
          </Text>
        </Link>
      </View>
    </KeyboardAwareScrollView>
  );
}
