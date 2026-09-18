/**
 * Android Health Connect implementation of `HealthProvider`.
 */
import { Linking } from 'react-native';
import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import type { DateKey } from '@/lib/date';

import type { HealthProvider } from './types';

/** The Play Store listing for the Health Connect app, opened when it isn't
 * installed at all (common on Android < 14, where it ships as a separate
 * app rather than being built into the OS). */
const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

/** Local-day boundaries as the ISO instants Health Connect's time filter wants. */
function dayBounds(date: DateKey): { startTime: string; endTime: string } {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(`${date}T23:59:59.999`);

  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

async function isAvailable(): Promise<boolean> {
  const status = await getSdkStatus();

  return status === SdkAvailabilityStatus.SDK_AVAILABLE;
}

async function requestPermissions(): Promise<boolean> {
  const status = await getSdkStatus();

  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
    // Not installed at all — send the user to install it instead of
    // silently failing every future attempt (spec requirement).
    await Linking.openURL(`market://details?id=${HEALTH_CONNECT_PACKAGE}`);
    return false;
  }

  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false; // e.g. needs a provider update

  await initialize();

  const granted = await requestPermission([{ accessType: 'read', recordType: 'Steps' }]);

  return granted.some((p) => p.recordType === 'Steps');
}

async function getStepCount(date: DateKey): Promise<number | null> {
  if (!(await isAvailable())) return null;

  await initialize();

  const { records } = await readRecords('Steps', {
    timeRangeFilter: { operator: 'between', ...dayBounds(date) },
  });

  if (records.length === 0) return null;

  return records.reduce((sum, record) => sum + record.count, 0);
}

export const healthConnectProvider: HealthProvider = {
  isAvailable,
  requestPermissions,
  getStepCount,
};
