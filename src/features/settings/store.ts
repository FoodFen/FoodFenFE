import { z } from 'zod';
import { create } from 'zustand';

import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { generateLocalId } from '@/lib/id';
import type { TimeOfDay } from '@/lib/notificationScheduler';
import { StorageKeys, preferences } from '@/lib/storage';
import type { QuestType } from '@/types/models';

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

export type MealReminder = {
  id: 'meal-breakfast' | 'meal-lunch' | 'meal-dinner';
  kind: 'meal';
  meal: 'breakfast' | 'lunch' | 'dinner';
  enabled: boolean;
  /** `null` = automatic: adapts to the user's usual meal time. */
  time: TimeOfDay | null;
  /** `null` = the app's translated default copy. */
  title: string | null;
  body: string | null;
};

export type CustomReminder = {
  id: `custom-${string}`;
  kind: 'custom';
  enabled: boolean;
  time: TimeOfDay;
  title: string;
  body: string;
};

export type Reminder = MealReminder | CustomReminder;

export type ReminderPatch = Partial<Pick<Reminder, 'time' | 'title' | 'body'>>;

export const MEAL_REMINDER_IDS: MealReminder['id'][] = [
  'meal-breakfast',
  'meal-lunch',
  'meal-dinner',
];

export function defaultMealReminders(enabled: boolean): MealReminder[] {
  return (['breakfast', 'lunch', 'dinner'] as const).map((meal) => ({
    id: `meal-${meal}`,
    kind: 'meal',
    meal,
    enabled,
    time: null,
    title: null,
    body: null,
  }));
}

function loadReminders(): Reminder[] {
  return (
    preferences.get<Reminder[]>(StorageKeys.reminders) ??
    defaultMealReminders(preferences.get<boolean>(StorageKeys.mealRemindersEnabled) ?? false)
  );
}

function persistReminders(reminders: Reminder[]) {
  preferences.set(StorageKeys.reminders, reminders);

  return { reminders };
}

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
  /**
   * Quest types that have already earned their one full-screen interstitial.
   * Progress on a type not in here still gets the full screen; every type
   * already seen gets a lightweight toast instead (UC-22's two-tier rule).
   */
  seenQuestTypes: QuestType[];
  /**
   * How many times each active quest's progress has moved, keyed by quest id.
   * Drives the toast's own throttle (first advance, then every other one, and
   * always the one that completes it) — a notification-frequency concern, not
   * domain data, so it lives here rather than in the quest row itself.
   */
  questAdvanceCounts: Record<string, number>;
  /**
   * Opt-in to reading today's step count from Health Connect (Android) /
   * HealthKit (iOS). Off by default — health data is sensitive, so this is
   * never requested without the user turning it on first.
   */
  healthSyncEnabled: boolean;
  /** Meal reminders first, then custom ones in creation order. */
  reminders: Reminder[];
  /** Local reminder before an active streak breaks for the day. */
  streakRemindersEnabled: boolean;

  setTheme: (theme: ThemePreference) => void;
  setWeightUnit: (unit: WeightUnit) => void;
  setEnergyUnit: (unit: EnergyUnit) => void;
  setLocale: (locale: Locale) => void;
  setDevSeedEnabled: (value: boolean) => void;
  setHideChallengeProgress: (value: boolean) => void;
  markQuestTypesSeen: (types: QuestType[]) => void;
  /**
   * Record another advance for `questId` and return the new count. Prunes any
   * counter not in `activeQuestIds` first, so a counter for a quest reissued
   * yesterday never lingers.
   */
  bumpQuestAdvance: (questId: string, activeQuestIds: string[]) => number;
  setHealthSyncEnabled: (value: boolean) => void;
  addReminder: (reminder: Omit<CustomReminder, 'id' | 'kind'>) => void;
  updateReminder: (id: Reminder['id'], patch: ReminderPatch) => void;
  /** Custom reminders only — meal reminders can be disabled, not deleted. */
  removeReminder: (id: Reminder['id']) => void;
  setReminderEnabled: (id: Reminder['id'], enabled: boolean) => void;
  resetReminders: () => void;
  setStreakRemindersEnabled: (value: boolean) => void;
  completeOnboarding: () => void;
  /** Part of "erase local data" — sends the user back through onboarding. */
  resetOnboarding: () => void;
}

const applyZodLocale = (locale: Locale) =>
  z.config(locale === 'vi' ? z.locales.vi() : z.locales.en());

const initialLocale = preferences.get<Locale>(StorageKeys.locale) ?? DEFAULT_LOCALE;
applyZodLocale(initialLocale);

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: preferences.get<ThemePreference>(StorageKeys.colorScheme) ?? 'system',
  weightUnit: preferences.get<WeightUnit>('weight-unit') ?? 'kg',
  energyUnit: preferences.get<EnergyUnit>('energy-unit') ?? 'kcal',
  locale: initialLocale,
  onboardingComplete: preferences.get<boolean>(StorageKeys.onboardingComplete) ?? false,
  devSeedEnabled: preferences.get<boolean>(StorageKeys.devSeed) ?? __DEV__,
  hideChallengeProgress:
    preferences.get<boolean>(StorageKeys.hideChallengeProgress) ?? false,
  seenQuestTypes: preferences.get<QuestType[]>(StorageKeys.seenQuestTypes) ?? [],
  questAdvanceCounts:
    preferences.get<Record<string, number>>(StorageKeys.questAdvanceCounts) ?? {},
  healthSyncEnabled: preferences.get<boolean>(StorageKeys.healthSyncEnabled) ?? false,
  reminders: loadReminders(),
  streakRemindersEnabled:
    preferences.get<boolean>(StorageKeys.streakRemindersEnabled) ?? false,

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
    applyZodLocale(locale);
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

  markQuestTypesSeen: (types) => {
    set((state) => {
      const seenQuestTypes = Array.from(new Set([...state.seenQuestTypes, ...types]));
      preferences.set(StorageKeys.seenQuestTypes, seenQuestTypes);
      return { seenQuestTypes };
    });
  },

  bumpQuestAdvance: (questId, activeQuestIds) => {
    let nextCount = 0;

    set((state) => {
      const activeIds = new Set(activeQuestIds);
      const pruned: Record<string, number> = {};

      for (const [id, count] of Object.entries(state.questAdvanceCounts)) {
        if (activeIds.has(id)) pruned[id] = count;
      }

      nextCount = (pruned[questId] ?? 0) + 1;
      pruned[questId] = nextCount;

      preferences.set(StorageKeys.questAdvanceCounts, pruned);

      return { questAdvanceCounts: pruned };
    });

    return nextCount;
  },

  setHealthSyncEnabled: (healthSyncEnabled) => {
    preferences.set(StorageKeys.healthSyncEnabled, healthSyncEnabled);
    set({ healthSyncEnabled });
  },

  addReminder: (reminder) => {
    set((state) =>
      persistReminders([
        ...state.reminders,
        { ...reminder, id: `custom-${generateLocalId('r')}`, kind: 'custom' },
      ]),
    );
  },

  updateReminder: (id, patch) => {
    set((state) =>
      persistReminders(
        state.reminders.map((r) => (r.id === id ? ({ ...r, ...patch } as Reminder) : r)),
      ),
    );
  },

  removeReminder: (id) => {
    set((state) =>
      persistReminders(state.reminders.filter((r) => r.id !== id || r.kind === 'meal')),
    );
  },

  setReminderEnabled: (id, enabled) => {
    set((state) =>
      persistReminders(state.reminders.map((r) => (r.id === id ? { ...r, enabled } : r))),
    );
  },

  resetReminders: () => {
    set(persistReminders(defaultMealReminders(false)));
  },

  setStreakRemindersEnabled: (streakRemindersEnabled) => {
    preferences.set(StorageKeys.streakRemindersEnabled, streakRemindersEnabled);
    set({ streakRemindersEnabled });
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
