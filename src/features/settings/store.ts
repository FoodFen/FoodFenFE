import { create } from 'zustand';

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
  onboardingComplete: boolean;

  setTheme: (theme: ThemePreference) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  setEnergyUnit: (unit: EnergyUnit) => void;
  completeOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: preferences.get<ThemePreference>(StorageKeys.colorScheme) ?? 'system',
  weightUnit: preferences.get<WeightUnit>('weight-unit') ?? 'kg',
  energyUnit: preferences.get<EnergyUnit>('energy-unit') ?? 'kcal',
  onboardingComplete: preferences.get<boolean>(StorageKeys.onboardingComplete) ?? false,

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

  completeOnboarding: () => {
    preferences.set(StorageKeys.onboardingComplete, true);
    set({ onboardingComplete: true });
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
