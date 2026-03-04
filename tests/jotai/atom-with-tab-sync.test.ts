import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore, atom } from 'jotai/vanilla';
import { atomWithTabSync } from '../../src/jotai/atom-with-tab-sync';
import type { TabSyncInstance } from '../../src/types';

// ── Mock BroadcastChannel ───────────────────────────────────────────────────

class MockBroadcastChannel {
  static instances = new Map<string, Set<MockBroadcastChannel>>();
  name: string;
  private listeners: Array<(event: MessageEvent) => void> = [];

  constructor(name: string) {
    this.name = name;
    const set = MockBroadcastChannel.instances.get(name) ?? new Set();
    set.add(this);
    MockBroadcastChannel.instances.set(name, set);
  }

  postMessage(data: unknown) {
    const peers = MockBroadcastChannel.instances.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this) continue;
      const event = new MessageEvent('message', { data });
      for (const listener of peer.listeners) {
        queueMicrotask(() => listener(event));
      }
    }
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  close() {
    MockBroadcastChannel.instances.get(this.name)?.delete(this);
    this.listeners = [];
  }

  static reset() {
    MockBroadcastChannel.instances.clear();
  }
}

const original_bc = globalThis.BroadcastChannel;

beforeEach(() => {
  vi.useFakeTimers();
  MockBroadcastChannel.reset();
  (globalThis as Record<string, unknown>).BroadcastChannel = MockBroadcastChannel;
});

afterEach(() => {
  vi.useRealTimers();
  if (original_bc) {
    globalThis.BroadcastChannel = original_bc;
  } else {
    delete (globalThis as Record<string, unknown>).BroadcastChannel;
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function flushSync() {
  vi.advanceTimersByTime(20);
  await vi.advanceTimersByTimeAsync(0);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('atomWithTabSync — basic', () => {
  it('returns the initial value before any sync', () => {
    const count_atom = atomWithTabSync('count', 0, { channel: 'basic-1' });
    const store = createStore();

    expect(store.get(count_atom)).toBe(0);
  });

  it('updates value via set with updater function', () => {
    const count_atom = atomWithTabSync('count', 0, { channel: 'basic-2' });
    const store = createStore();

    store.sub(count_atom, () => {});
    store.set(count_atom, (prev) => prev + 1);

    expect(store.get(count_atom)).toBe(1);
  });

  it('updates value via set with direct value', () => {
    const theme_atom = atomWithTabSync('theme', 'light', { channel: 'basic-3' });
    const store = createStore();

    store.sub(theme_atom, () => {});
    store.set(theme_atom, 'dark');

    expect(store.get(theme_atom)).toBe('dark');
  });
});

describe('atomWithTabSync — cross-tab sync', () => {
  it('syncs value from Tab A to Tab B', async () => {
    const atom_a = atomWithTabSync('count', 0, { channel: 'sync-1' });
    const atom_b = atomWithTabSync('count', 0, { channel: 'sync-1' });

    const store_a = createStore();
    const store_b = createStore();

    store_a.sub(atom_a, () => {});
    store_b.sub(atom_b, () => {});

    store_a.set(atom_a, 42);
    await flushSync();

    expect(store_b.get(atom_b)).toBe(42);
  });

  it('syncs bidirectionally', async () => {
    const atom_a = atomWithTabSync('val', 'hello', { channel: 'sync-2' });
    const atom_b = atomWithTabSync('val', 'hello', { channel: 'sync-2' });

    const store_a = createStore();
    const store_b = createStore();

    store_a.sub(atom_a, () => {});
    store_b.sub(atom_b, () => {});

    store_a.set(atom_a, 'from-a');
    await flushSync();
    expect(store_b.get(atom_b)).toBe('from-a');

    store_b.set(atom_b, 'from-b');
    await flushSync();
    expect(store_a.get(atom_a)).toBe('from-b');
  });

  it('handles updater function synced correctly', async () => {
    const atom_a = atomWithTabSync('count', 0, { channel: 'sync-3' });
    const atom_b = atomWithTabSync('count', 0, { channel: 'sync-3' });

    const store_a = createStore();
    const store_b = createStore();

    store_a.sub(atom_a, () => {});
    store_b.sub(atom_b, () => {});

    store_a.set(atom_a, (prev) => prev + 10);
    await flushSync();

    expect(store_a.get(atom_a)).toBe(10);
    expect(store_b.get(atom_b)).toBe(10);
  });
});

describe('atomWithTabSync — multiple atoms on same channel', () => {
  it('syncs multiple atoms independently via separate keys', async () => {
    const count_a = atomWithTabSync('count', 0, { channel: 'multi-1' });
    const theme_a = atomWithTabSync('theme', 'light', { channel: 'multi-1' });
    const count_b = atomWithTabSync('count', 0, { channel: 'multi-1' });
    const theme_b = atomWithTabSync('theme', 'light', { channel: 'multi-1' });

    const store_a = createStore();
    const store_b = createStore();

    store_a.sub(count_a, () => {});
    store_a.sub(theme_a, () => {});
    store_b.sub(count_b, () => {});
    store_b.sub(theme_b, () => {});

    store_a.set(count_a, 99);
    await flushSync();

    expect(store_b.get(count_b)).toBe(99);
    expect(store_b.get(theme_b)).toBe('light');

    store_a.set(theme_a, 'dark');
    await flushSync();

    expect(store_b.get(theme_b)).toBe('dark');
    expect(store_b.get(count_b)).toBe(99);
  });
});

describe('atomWithTabSync — derived atom compatibility', () => {
  it('works with derived read-only atoms', async () => {
    const count_a = atomWithTabSync('count', 0, { channel: 'derived-1' });
    const count_b = atomWithTabSync('count', 0, { channel: 'derived-1' });

    const doubled_b = atom((get) => get(count_b) * 2);

    const store_a = createStore();
    const store_b = createStore();

    store_a.sub(count_a, () => {});
    store_b.sub(doubled_b, () => {});

    store_a.set(count_a, 5);
    await flushSync();

    expect(store_b.get(doubled_b)).toBe(10);
  });
});

describe('atomWithTabSync — instance lifecycle', () => {
  it('destroys instance on unmount', () => {
    let captured_instance: TabSyncInstance<Record<string, unknown>> | null = null;

    const test_atom = atomWithTabSync('a', 0, {
      channel: 'lifecycle-1',
      onSyncReady: (i) => { captured_instance = i; },
    });

    const store = createStore();
    const unsub = store.sub(test_atom, () => {});

    expect(captured_instance).not.toBeNull();
    expect(captured_instance!.ready).toBe(true);

    unsub();
    expect(captured_instance!.ready).toBe(false);
  });

  it('invokes onSyncReady with the tab-bridge instance', () => {
    const ready_spy = vi.fn();
    const test_atom = atomWithTabSync('a', 0, {
      channel: 'lifecycle-2',
      onSyncReady: ready_spy,
    });

    const store = createStore();
    store.sub(test_atom, () => {});

    expect(ready_spy).toHaveBeenCalledTimes(1);
    expect(typeof ready_spy.mock.calls[0]![0].id).toBe('string');
  });
});

describe('atomWithTabSync — no circular updates', () => {
  it('does not re-broadcast remote state changes', async () => {
    const atom_a = atomWithTabSync('val', 'init', { channel: 'circular-1' });
    const atom_b = atomWithTabSync('val', 'init', { channel: 'circular-1' });

    const store_a = createStore();
    const store_b = createStore();

    const listener_b = vi.fn();
    store_a.sub(atom_a, () => {});
    store_b.sub(atom_b, listener_b);

    store_a.set(atom_a, 'updated');
    await flushSync();

    const count_after = listener_b.mock.calls.length;

    await flushSync();
    await flushSync();

    expect(listener_b.mock.calls.length).toBe(count_after);
  });
});

describe('atomWithTabSync — channel scoping', () => {
  it('atoms with different keys on same channel do not interfere', async () => {
    const count_a = atomWithTabSync('count', 0, { channel: 'scope-1' });
    const name_a = atomWithTabSync('name', 'alice', { channel: 'scope-1' });
    const count_b = atomWithTabSync('count', 0, { channel: 'scope-1' });
    const name_b = atomWithTabSync('name', 'alice', { channel: 'scope-1' });

    const store_a = createStore();
    const store_b = createStore();

    store_a.sub(count_a, () => {});
    store_a.sub(name_a, () => {});
    store_b.sub(count_b, () => {});
    store_b.sub(name_b, () => {});

    store_a.set(count_a, 100);
    await flushSync();

    expect(store_b.get(count_b)).toBe(100);
    expect(store_b.get(name_b)).toBe('alice');
  });

  it('atoms with same key on different channels do not interfere', async () => {
    const atom_a = atomWithTabSync('count', 0, { channel: 'ch-a' });
    const atom_b = atomWithTabSync('count', 0, { channel: 'ch-b' });

    const store_a = createStore();
    const store_b = createStore();

    store_a.sub(atom_a, () => {});
    store_b.sub(atom_b, () => {});

    store_a.set(atom_a, 999);
    await flushSync();

    expect(store_b.get(atom_b)).toBe(0);
  });
});
