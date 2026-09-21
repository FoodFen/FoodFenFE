import { Platform } from 'react-native';

import { healthConnectProvider } from './healthConnect';
import { healthKitProvider } from './healthKit';
import type { HealthProvider } from './types';

export type { HealthProvider } from './types';

export function getHealthProvider(): HealthProvider {
  return Platform.OS === 'ios' ? healthKitProvider : healthConnectProvider;
}
