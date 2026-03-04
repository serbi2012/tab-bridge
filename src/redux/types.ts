import type { TabSyncInstance } from '../types';

/** Action type dispatched internally when merging remote state. */
export const TAB_SYNC_MERGE_ACTION = '@@tab-bridge/MERGE' as const;

export interface TabSyncMergeAction {
  type: typeof TAB_SYNC_MERGE_ACTION;
  payload: Record<string, unknown>;
}

/**
 * Options for `tabSyncEnhancer`.
 *
 * @example
 * ```ts
 * import { configureStore } from '@reduxjs/toolkit';
 * import { tabSyncEnhancer } from 'tab-bridge/redux';
 *
 * const store = configureStore({
 *   reducer: rootReducer,
 *   enhancers: (getDefault) =>
 *     getDefault().concat(tabSyncEnhancer({ channel: 'my-app' })),
 * });
 * ```
 */
export interface TabSyncReduxOptions {
  /** Channel name for cross-tab communication. @default 'tab-sync-redux' */
  channel?: string;

  /**
   * Only sync these top-level state keys (reducer slice names).
   * Mutually exclusive with `exclude`.
   */
  include?: readonly string[];

  /**
   * Exclude these top-level state keys from syncing.
   * Mutually exclusive with `include`.
   */
  exclude?: readonly string[];

  /**
   * Custom conflict resolution.
   * @default Last-write-wins (LWW)
   */
  merge?: (localValue: unknown, remoteValue: unknown, key: string) => unknown;

  /** Force a specific transport layer. @default auto-detect */
  transport?: 'broadcast-channel' | 'local-storage';

  /** Enable debug logging. @default false */
  debug?: boolean;

  /** Error callback for non-fatal errors. */
  onError?: (error: Error) => void;

  /**
   * Callback invoked when the underlying `TabSyncInstance` is ready.
   * Use this to access advanced features (RPC, leader election, etc.)
   * or to store a reference for manual cleanup.
   */
  onSyncReady?: (instance: TabSyncInstance<Record<string, unknown>>) => void;
}
