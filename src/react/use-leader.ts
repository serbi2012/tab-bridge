import { useCallback, useContext, useRef, useSyncExternalStore } from 'react';
import type { TabSyncInstance } from '../types';
import { TabSyncContext } from './context';

const SERVER_SNAPSHOT = false;

/**
 * Subscribe to leader status. Re-renders only when leadership changes.
 *
 * Must be used within a `<TabSyncProvider>`.
 */
export function useIsLeader(): boolean {
  const instance = useContext(TabSyncContext) as TabSyncInstance<
    Record<string, unknown>
  > | null;

  if (!instance) {
    throw new Error('useIsLeader must be used within a <TabSyncProvider>');
  }

  const leaderRef = useRef(instance.isLeader());

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsub = instance.onLeader(() => {
        leaderRef.current = true;
        onStoreChange();
        return () => {
          leaderRef.current = false;
          onStoreChange();
        };
      });
      return unsub;
    },
    [instance],
  );

  const getSnapshot = useCallback(() => leaderRef.current, []);
  const getServerSnapshot = useCallback(() => SERVER_SNAPSHOT, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
