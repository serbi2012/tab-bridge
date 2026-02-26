import {
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
  useState,
  useEffect,
} from 'react';
import type { TabSyncOptions, TabSyncInstance, TabInfo } from '../types';
import { createTabSync } from '../core/tab-sync';
import { TabSyncContext } from './context';

const EMPTY_TABS: TabInfo[] = [];

function useInstance<TState extends Record<string, unknown>>(
  options?: TabSyncOptions<TState>,
): TabSyncInstance<TState> {
  const contextInstance = useContext(TabSyncContext);

  const [ownInstance] = useState(() => {
    if (!contextInstance && options) {
      return createTabSync<TState>(options);
    }
    return null;
  });

  useEffect(() => {
    return () => ownInstance?.destroy();
  }, [ownInstance]);

  const instance = (contextInstance ?? ownInstance) as TabSyncInstance<TState> | null;

  if (!instance) {
    throw new Error(
      'useTabSync: provide options for standalone use, or wrap with <TabSyncProvider>',
    );
  }

  return instance;
}

export function useTabSync<TState extends Record<string, unknown>>(
  options?: TabSyncOptions<TState>,
): {
  state: Readonly<TState>;
  set: <K extends keyof TState>(key: K, value: TState[K]) => void;
  patch: (partial: Partial<TState>) => void;
  isLeader: boolean;
  tabs: TabInfo[];
  tabId: string;
} {
  const instance = useInstance<TState>(options);

  // ── State ──
  const stateSubscribe = useCallback(
    (cb: () => void) => instance.onChange(() => cb()),
    [instance],
  );
  const getStateSnapshot = useCallback(() => instance.getAll(), [instance]);
  const state = useSyncExternalStore(
    stateSubscribe,
    getStateSnapshot,
    getStateSnapshot,
  );

  // ── Leader ──
  const leaderRef = useRef(instance.isLeader());
  const leaderSubscribe = useCallback(
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
  const getLeaderSnapshot = useCallback(() => leaderRef.current, []);
  const getLeaderServerSnapshot = useCallback(() => false, []);
  const isLeader = useSyncExternalStore(
    leaderSubscribe,
    getLeaderSnapshot,
    getLeaderServerSnapshot,
  );

  // ── Tabs ──
  const tabsRef = useRef(instance.getTabs());
  const tabsSubscribe = useCallback(
    (cb: () => void) =>
      instance.onTabChange((tabs) => {
        tabsRef.current = tabs;
        cb();
      }),
    [instance],
  );
  const getTabsSnapshot = useCallback(() => tabsRef.current, []);
  const getTabsServerSnapshot = useCallback(() => EMPTY_TABS, []);
  const tabs = useSyncExternalStore(
    tabsSubscribe,
    getTabsSnapshot,
    getTabsServerSnapshot,
  );

  return {
    state,
    set: instance.set,
    patch: instance.patch,
    isLeader,
    tabs,
    tabId: instance.id,
  };
}
