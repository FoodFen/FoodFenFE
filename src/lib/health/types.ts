import type { DateKey } from '@/lib/date';

/**
 * A source of on-device health data, abstracted over the two platform SDKs
 * (Health Connect on Android, HealthKit on iOS) so the rest of the app never
 * branches on Platform.OS itself — see `./index.ts`.
 *
 * Deliberately minimal: today this only reads a daily step total. The next
 * natural extension point, if full workout import (UC-17's fuller scope) is
 * ever built, is a `getWorkouts(range): Promise<HealthWorkout[]>` method here
 * — not added now, since nothing calls it yet.
 */
export interface HealthProvider {
  /** Whether this platform's health SDK exists and is usable on this device
   * (e.g. false if Health Connect isn't installed on an Android < 14 device). */
  isAvailable(): Promise<boolean>;
  /** Prompts the OS permission dialog. Resolves true only if steps read
   * access was granted. */
  requestPermissions(): Promise<boolean>;
  /**
   * Total steps for the given local calendar day. Both platforms can answer
   * for past days as well as today; returns null if there is no permission,
   * no provider on this device, or no recorded data for that day (including
   * "before health tracking started on this phone").
   */
  getStepCount(date: DateKey): Promise<number | null>;
}
