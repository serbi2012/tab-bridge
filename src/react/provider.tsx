import { useEffect, useRef, type ReactNode } from 'react';
import type { TabSyncOptions } from '../types';
import { createTabSync } from '../core/tab-sync';
import { TabSyncContext } from './context';

export interface TabSyncProviderProps<TState extends Record<string, unknown>> {
  options: TabSyncOptions<TState>;
  children: ReactNode;
}

/**
 * Provides a shared `TabSyncInstance` to all children via context.
 * The instance is created once and destroyed on unmount.
 */
export function TabSyncProvider<TState extends Record<string, unknown>>({
  options,
  children,
}: TabSyncProviderProps<TState>) {
  const instanceRef = useRef<ReturnType<typeof createTabSync<TState>> | null>(null);
  if (!instanceRef.current) {
    instanceRef.current = createTabSync<TState>(options);
  }

  useEffect(() => {
    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, []);

  return (
    <TabSyncContext.Provider value={instanceRef.current}>
      {children}
    </TabSyncContext.Provider>
  );
}
