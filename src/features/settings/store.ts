import { create } from 'zustand';

import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { StorageKeys, preferences } from '@/lib/storage';

/**
 * Device-local preferences.
 *
 * These are deliberately not part of the user account: theme and units are a
 * property of the device you are holding, and they must be readable
 * synchronously at first paint (MMKV) so the app never flashes the wrong theme.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type WeightUnit = 'kg' | 'lb';
export type EnergyUnit = 'kcal' | 'kJ';

interface SettingsState {
  theme: ThemePreference;
  weightUnit: WeightUnit;
  energyUnit: EnergyUnit;
  locale: Locale;
  onboardingComplete: boolean;
  /** Dev-only: populate the last few diary days on boot. Defaults to `__DEV__`. */
  devSeedEnabled: boolean;
  /** UC-22's per-user opt-out — skip the post-log challenge interstitial. */
  hideChallengeProgress: boolean;

  setTheme: (theme: ThemePreference) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  setEnergyUnit: (unit: EnergyUnit) => void;
  setLocale: (locale: Locale) => void;
  setDevSeedEnabled: (value: boolean) => void;
  setHideChallengeProgress: (value: boolean) => void;
  completeOnboarding: () => void;
  /** Part of "erase local data" — sends the user back through onboarding. */
  resetOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: preferences.get<ThemePreference>(StorageKeys.colorScheme) ?? 'system',
  weightUnit: preferences.get<WeightUnit>('weight-unit') ?? 'kg',
  energyUnit: preferences.get<EnergyUnit>('energy-unit') ?? 'kcal',
  locale: preferences.get<Locale>(StorageKeys.locale) ?? DEFAULT_LOCALE,
  onboardingComplete: preferences.get<boolean>(StorageKeys.onboardingComplete) ?? false,
  devSeedEnabled: preferences.get<boolean>(StorageKeys.devSeed) ?? __DEV__,
  hideChallengeProgress:
    preferences.get<boolean>(StorageKeys.hideChallengeProgress) ?? false,

  setTheme: (theme) => {
    preferences.set(StorageKeys.colorScheme, theme);
    set({ theme });
  },

  setWeightUnit: (weightUnit) => {
    preferences.set('weight-unit', weightUnit);
    set({ weightUnit });
  },

  setEnergyUnit: (energyUnit) => {
    preferences.set('energy-unit', energyUnit);
    set({ energyUnit });
  },

  setLocale: (locale) => {
    preferences.set(StorageKeys.locale, locale);
    set({ locale });
  },

  setDevSeedEnabled: (devSeedEnabled) => {
    preferences.set(StorageKeys.devSeed, devSeedEnabled);
    set({ devSeedEnabled });
  },

  setHideChallengeProgress: (hideChallengeProgress) => {
    preferences.set(StorageKeys.hideChallengeProgress, hideChallengeProgress);
    set({ hideChallengeProgress });
  },

  completeOnboarding: () => {
    preferences.set(StorageKeys.onboardingComplete, true);
    set({ onboardingComplete: true });
  },

  resetOnboarding: () => {
    preferences.remove(StorageKeys.onboardingComplete);
    set({ onboardingComplete: false });
  },
}));

const KG_PER_LB = 0.45359237;
const KJ_PER_KCAL = 4.184;

/** Display conversions. Storage is always metric + kcal. */
export const units = {
  weightFromKg: (kg: number, unit: WeightUnit): number =>
    unit === 'kg' ? kg : kg / KG_PER_LB,

  weightToKg: (value: number, unit: WeightUnit): number =>
    unit === 'kg' ? value : value * KG_PER_LB,

  energyFromKcal: (kcal: number, unit: EnergyUnit): number =>
    unit === 'kcal' ? kcal : kcal * KJ_PER_KCAL,
};
