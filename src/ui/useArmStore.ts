/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useSyncExternalStore } from 'react';
import { armStore } from '../state/armStore.ts';

export function useArmStore() {
  return useSyncExternalStore(
    (callback) => armStore.subscribe(callback),
    () => armStore
  );
}
