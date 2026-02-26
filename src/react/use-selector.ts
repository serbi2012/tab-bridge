import { useCallback, useContext, useRef, useSyncExternalStore } from 'react';
import type { TabSyncInstance } from '../types';
import { TabSyncContext } from './context';

/**
 * Subscribe to a **derived value** from the synced state.
 * Only re-renders when the selector's output actually changes.
 *
 * ```tsx
 * const doneCount = useTabSyncSelector(
 *   (s) => s.todos.filter(t => t.done).length,
 * );
 *
 * // With custom equality (e.g. for arrays/objects):
 * const activeTabs = useTabSyncSelector(
 *   (s) => s.tabs.filter(t => t.active),
 *   (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
 * );
 * ```
 *
 * Must be used within a `<TabSyncProvider>`.
 */
export function useTabSyncSelector<
  TState extends Record<string, unknown>,
  TResult,
>(
  selector: (state: Readonly<TState>) => TResult,
  isEqual?: (a: TResult, b: TResult) => boolean,
): TResult {
  const instance = useContext(TabSyncContext) as TabSyncInstance<TState> | null;

  if (!instance) {
    throw new Error('useTabSyncSelector must be used within a <TabSyncProvider>');
  }

  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);
  const resultRef = useRef<TResult>(undefined as TResult);
  const initializedRef = useRef(false);

  selectorRef.current = selector;
  isEqualRef.current = isEqual;

  if (!initializedRef.current) {
    resultRef.current = selector(instance.getAll());
    initializedRef.current = true;
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      instance.onChange(() => {
        const next = selectorRef.current(instance.getAll());
        const equal = isEqualRef.current ?? Object.is;
        if (!equal(resultRef.current, next)) {
          resultRef.current = next;
          onStoreChange();
        }
      }),
    [instance],
  );

  const getSnapshot = useCallback(() => resultRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
