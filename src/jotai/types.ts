import type { TabSyncInstance } from '../types';

/**
 * Options for `atomWithTabSync`.
 *
 * All atoms sharing the same `channel` reuse a single `createTabSync`
 * instance internally. Channel-level options (`transport`, `debug`,
 * `onError`) are taken from the **first** atom that creates the
 * instance on that channel.
 *
 * @example
 * ```ts
 * import { atomWithTabSync } from 'tab-bridge/jotai';
 *
 * const countAtom = atomWithTabSync('count', 0, {
 *   channel: 'my-app',
 *   debug: true,
 * });
 * ```
 */
export interface AtomWithTabSyncOptions {
  /** Channel name for cross-tab communication. @default 'tab-sync-jotai' */
  channel?: string;

  /** Force a specific transport layer. @default auto-detect */
  transport?: 'broadcast-channel' | 'local-storage';

  /** Enable debug logging. @default false */
  debug?: boolean;

  /** Error callback for non-fatal errors (channel failures, etc.). */
  onError?: (error: Error) => void;

  /**
   * Callback invoked when the underlying `TabSyncInstance` is ready.
   * Useful for accessing advanced features (RPC, leader election, etc.).
   * Called once per shared instance — only the first atom to trigger
   * instance creation will have its callback invoked.
   */
  onSyncReady?: (instance: TabSyncInstance<Record<string, unknown>>) => void;
}
