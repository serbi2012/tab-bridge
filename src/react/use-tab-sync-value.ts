import { useCallback, useContext, useSyncExternalStore } from 'react';
import type { TabSyncInstance } from '../types';
import { TabSyncContext } from './context';

/**
 * Subscribe to a single key for minimal re-renders.
 *
 * Must be used within a `<TabSyncProvider>`.
 */
export function useTabSyncValue<
  TState extends Record<string, unknown>,
  K extends keyof TState,
>(key: K): TState[K] {
  const instance = useContext(TabSyncContext) as TabSyncInstance<TState> | null;

  if (!instance) {
    throw new Error('useTabSyncValue must be used within a <TabSyncProvider>');
  }

  const subscribe = useCallback(
    (cb: () => void) => instance.on(key, () => cb()),
    [instance, key],
  );

  const getSnapshot = useCallback(() => instance.get(key), [instance, key]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
