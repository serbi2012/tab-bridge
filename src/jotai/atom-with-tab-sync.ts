import { atom } from 'jotai/vanilla';
import type { WritableAtom } from 'jotai/vanilla';
import { createTabSync } from '../core/tab-sync';
import type { TabSyncInstance } from '../types';
import { isBrowser } from '../utils/env';
import type { AtomWithTabSyncOptions } from './types';

// ── Types ───────────────────────────────────────────────────────────────────

type SetStateAction<T> = T | ((prev: T) => T);

// ── atomWithTabSync ─────────────────────────────────────────────────────────

/**
 * Creates a Jotai atom whose value is automatically synchronised across
 * browser tabs via `tab-bridge`.
 *
 * Each atom creates its own `createTabSync` instance scoped to the channel
 * `${channel}:${key}`. The instance is created when the atom is first
 * subscribed to (React component mount / `store.sub`) and destroyed on
 * the last unsubscription (unmount).
 *
 * The atom behaves like a normal writable atom — use `useAtom` in React
 * or `store.get` / `store.set` with Jotai's vanilla store.
 *
 * @param key - Unique key identifying this piece of state within the channel.
 * @param initialValue - Default value used when no synced state exists yet.
 * @param options - Channel and transport configuration.
 * @returns A writable Jotai atom.
 *
 * @example
 * ```ts
 * import { atomWithTabSync } from 'tab-bridge/jotai';
 *
 * const countAtom = atomWithTabSync('count', 0, { channel: 'my-app' });
 * const themeAtom = atomWithTabSync('theme', 'light', { channel: 'my-app' });
 * ```
 */
export function atomWithTabSync<T>(
  key: string,
  initialValue: T,
  options?: AtomWithTabSyncOptions,
): WritableAtom<T, [SetStateAction<T>], void> {
  const base_channel = options?.channel ?? 'tab-sync-jotai';
  const instance_channel = `${base_channel}:${key}`;

  let sync_instance: TabSyncInstance<Record<string, unknown>> | null = null;

  const base_atom = atom(initialValue);

  base_atom.onMount = (setAtom) => {
    if (!isBrowser) return;

    const instance = createTabSync({
      channel: instance_channel,
      initial: { value: initialValue },
      transport: options?.transport,
      debug: options?.debug,
      onError: options?.onError,
    });
    sync_instance = instance;
    options?.onSyncReady?.(instance);

    const unsub = instance.on('value', (remote_value, meta) => {
      if (!meta.isLocal) {
        setAtom(remote_value as T);
      }
    });

    return () => {
      unsub();
      instance.destroy();
      sync_instance = null;
    };
  };

  const sync_atom = atom(
    (get) => get(base_atom),
    (get, set, update: SetStateAction<T>) => {
      const next_value =
        typeof update === 'function'
          ? (update as (prev: T) => T)(get(base_atom))
          : update;
      set(base_atom, next_value);
      sync_instance?.set('value', next_value as unknown);
    },
  );

  return sync_atom as WritableAtom<T, [SetStateAction<T>], void>;
}
