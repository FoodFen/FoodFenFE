import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isApiError } from '@/api/errors';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { SocialSignInButtons } from '@/components/auth/SocialSignInButtons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { announceAndLeave } from '@/features/auth/announceAndLeave';
import { makeSignUpSchema } from '@/features/auth/schemas';
import type { SignUpValues } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/store';
import { useTranslation } from '@/hooks/useTranslation';

export default function SignUpScreen() {
  const signUp = useAuthStore((state) => state.signUp);
  const [formError, setFormError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const schema = useMemo(() => makeSignUpSchema(t), [t]);

  const {
    control,
    handleSubmit,
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

      // Leaves to wherever this was opened from, or into setup if no profile came back.
      announceAndLeave(
        t('auth', 'signUpSuccessTitle'),
        t('auth', 'signUpSuccessMessage'),
        t('common', 'done'),
        t('auth', 'signedInNeedsSetup'),
      );
    } catch (error) {
      if (isApiError(error)) {
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
        paddingBottom: 32 + insets.bottom,
        paddingHorizontal: 24,
      }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View className="w-full max-w-md flex-1 self-center">
        <AuthHeader
          title={t('auth', 'createYourAccount')}
          subtitle={t('auth', 'signUpSubtitle')}
        />

        <View className="gap-4">
          <SocialSignInButtons
            onError={setFormError}
            onSuccess={() =>
              announceAndLeave(
                t('auth', 'signInSuccessTitle'),
                t('auth', 'signInSuccessMessage'),
                t('common', 'done'),
                t('auth', 'signedInNeedsSetup'),
              )
            }
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
      </View>
    </KeyboardAwareScrollView>
  );
}
