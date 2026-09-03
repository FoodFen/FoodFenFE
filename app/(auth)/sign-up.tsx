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
import { signUpSchema } from '@/features/auth/schemas';
import type { SignUpValues } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/store';

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const signUp = useAuthStore((state) => state.signUp);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
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
    } catch (error) {
      if (isApiError(error)) {
        if (error.fieldErrors?.email) {
          setError('email', { message: error.fieldErrors.email });
        }

        setFormError(error.userMessage);
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
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
      }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View className="gap-2 pb-6">
        <Text variant="title">Create your account</Text>
        <Text variant="body" tone="muted">
          We will use a few details to work out your daily calorie target.
        </Text>
      </View>

      <View className="gap-4">
        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Name"
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
              label="Email"
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
              label="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              hint="At least 8 characters, including a number."
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
              label="Confirm password"
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
          label="Create account"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          fullWidth
          size="lg"
          className="mt-2"
        />
      </View>

      <View className="mt-auto flex-row justify-center gap-1 pt-8">
        <Text variant="body" tone="muted">
          Already have an account?
        </Text>
        <Link href="/sign-in" asChild>
          <Text variant="body" tone="brand" accessibilityRole="link">
            Sign in
          </Text>
        </Link>
      </View>
    </KeyboardAwareScrollView>
  );
}
