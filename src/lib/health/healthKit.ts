/**
 * iOS HealthKit implementation of `HealthProvider`.
 */
import {
  isHealthDataAvailable,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import type { DateKey } from '@/lib/date';

import type { HealthProvider } from './types';

const STEP_COUNT_TYPE = 'HKQuantityTypeIdentifierStepCount';

/** Local-day boundaries as the Date objects the statistics query's date filter wants. */
function dayBounds(date: DateKey): { startDate: Date; endDate: Date } {
  return {
    startDate: new Date(`${date}T00:00:00`),
    endDate: new Date(`${date}T23:59:59.999`),
  };
}

async function isAvailable(): Promise<boolean> {
  return isHealthDataAvailable();
}

async function requestPermissions(): Promise<boolean> {
  if (!(await isAvailable())) return false;

  try {
    await requestAuthorization({ toRead: [STEP_COUNT_TYPE], toShare: [] });
    return true;
  } catch {
    return false;
  }
}

async function getStepCount(date: DateKey): Promise<number | null> {
  if (!(await isAvailable())) return null;

  try {
    const stats = await queryStatisticsForQuantity(STEP_COUNT_TYPE, ['cumulativeSum'], {
      filter: { date: dayBounds(date) },
      unit: 'count',
    });

    const total = stats.sumQuantity?.quantity;

    // The query succeeded but found no samples for the day (e.g. before health
    // tracking started, or nothing walked yet) — that's 0 steps, not a failure.
    return typeof total === 'number' ? Math.round(total) : 0;
  } catch {
    // Permission revoked from system Settings after being granted, or any
    // other native-layer read failure — treat as "nothing usable" per the
    // documented HealthProvider contract, rather than throwing.
    return null;
  }
}

export const healthKitProvider: HealthProvider = {
  isAvailable,
  requestPermissions,
  getStepCount,
};
