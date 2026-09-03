import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { signInSchema } from '@/features/auth/schemas';
import type { SignInValues } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/store';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((state) => state.signIn);

  /** Errors that belong to the request rather than a single field. */
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await signIn(values);
      // No navigation here: the root layout's guard swaps the stack as soon as
      // the store reports an authenticated session.
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
            ? 'That email and password do not match.'
            : error.userMessage,
        );
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  });

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + 48,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
      }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View className="gap-2 pb-8">
        <Text className="text-5xl">🥗</Text>
        <Text variant="title">Welcome back</Text>
        <Text variant="body" tone="muted">
          Sign in to pick up your diary where you left off.
        </Text>
      </View>

      <View className="gap-4">
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
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
              label="Password"
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
          label="Sign in"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          fullWidth
          size="lg"
          className="mt-2"
        />
      </View>

      <View className="mt-auto flex-row justify-center gap-1 pt-8">
        <Text variant="body" tone="muted">
          New to FoodFen?
        </Text>
        <Link href="/sign-up" asChild>
          <Text variant="body" tone="brand" accessibilityRole="link">
            Create an account
          </Text>
        </Link>
      </View>
    </KeyboardAwareScrollView>
  );
}
