import type { StoreEnhancer, Action, Reducer, UnknownAction } from 'redux';
import { createTabSync } from '../core/tab-sync';
import type { TabSyncInstance } from '../types';
import { isBrowser } from '../utils/env';
import { TAB_SYNC_MERGE_ACTION } from './types';
import type { TabSyncMergeAction, TabSyncReduxOptions } from './types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function shouldSyncKey(key: string, options?: TabSyncReduxOptions): boolean {
  if (options?.include) return options.include.includes(key);
  if (options?.exclude) return !options.exclude.includes(key);
  return true;
}

function extractSyncableState(
  state: Record<string, unknown>,
  options?: TabSyncReduxOptions,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(state)) {
    if (shouldSyncKey(key, options)) {
      result[key] = state[key];
    }
  }
  return result;
}

function validateOptions(options?: TabSyncReduxOptions): void {
  if (options?.include && options?.exclude) {
    throw new Error(
      '[tab-bridge/redux] `include` and `exclude` are mutually exclusive',
    );
  }
}

function isTabSyncMerge(action: unknown): action is TabSyncMergeAction {
  return (
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    (action as { type: unknown }).type === TAB_SYNC_MERGE_ACTION
  );
}

// ── Store Enhancer ──────────────────────────────────────────────────────────

/**
 * Redux store enhancer that synchronises state across browser tabs
 * via `tab-bridge`.
 *
 * The enhancer wraps the root reducer to handle an internal merge action,
 * then creates a `tab-bridge` instance that keeps local and remote state
 * in sync. Only **top-level keys** (typically slice names) that pass the
 * `include` / `exclude` filter are synchronised.
 *
 * @param options - Synchronization options.
 * @returns A Redux `StoreEnhancer`.
 *
 * @example
 * ```ts
 * import { configureStore } from '@reduxjs/toolkit';
 * import { tabSyncEnhancer } from 'tab-bridge/redux';
 *
 * const store = configureStore({
 *   reducer: { counter: counterReducer, theme: themeReducer },
 *   enhancers: (getDefault) =>
 *     getDefault().concat(tabSyncEnhancer({ channel: 'my-app' })),
 * });
 * ```
 */
export function tabSyncEnhancer(options?: TabSyncReduxOptions): StoreEnhancer {
  validateOptions(options);

  return (next) =>
    <S, A extends Action = UnknownAction, PreloadedState = S>(
      reducer: Reducer<S, A, PreloadedState>,
      preloadedState?: PreloadedState | undefined,
    ) => {
      const wrapped_reducer = ((state: S | PreloadedState | undefined, action: A) => {
        if (isTabSyncMerge(action)) {
          const current = (state ?? {}) as Record<string, unknown>;
          return { ...current, ...action.payload } as S;
        }
        return reducer(state, action);
      }) as Reducer<S, A, PreloadedState>;

      const store = next(wrapped_reducer, preloadedState);

      if (!isBrowser) return store;

      const initial_state = store.getState() as Record<string, unknown>;
      const syncable_initial = extractSyncableState(initial_state, options);

      const sync_instance: TabSyncInstance<Record<string, unknown>> =
        createTabSync({
          channel: options?.channel ?? 'tab-sync-redux',
          initial: syncable_initial,
          transport: options?.transport,
          debug: options?.debug,
          merge: options?.merge,
          onError: options?.onError,
        });

      let is_remote_update = false;
      let prev_state = initial_state;

      store.subscribe(() => {
        if (is_remote_update) return;

        const next_state = store.getState() as Record<string, unknown>;
        const diff: Record<string, unknown> = {};
        let has_diff = false;

        for (const key of Object.keys(next_state)) {
          if (
            shouldSyncKey(key, options) &&
            !Object.is(prev_state[key], next_state[key])
          ) {
            diff[key] = next_state[key];
            has_diff = true;
          }
        }

        prev_state = next_state;

        if (has_diff) {
          sync_instance.patch(diff);
        }
      });

      sync_instance.onChange((remote_state, changed_keys, meta) => {
        if (meta.isLocal) return;

        const patch: Record<string, unknown> = {};
        let has_patch = false;
        for (const key of changed_keys) {
          patch[key as string] = remote_state[key as string];
          has_patch = true;
        }

        if (has_patch) {
          is_remote_update = true;
          try {
            store.dispatch({
              type: TAB_SYNC_MERGE_ACTION,
              payload: patch,
            } as unknown as A);
          } finally {
            is_remote_update = false;
          }
        }
      });

      options?.onSyncReady?.(sync_instance);

      return store;
    };
}
