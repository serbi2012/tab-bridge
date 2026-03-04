import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore, createSlice } from '@reduxjs/toolkit';
import { tabSyncEnhancer } from '../../src/redux/enhancer';
import { TAB_SYNC_MERGE_ACTION } from '../../src/redux/types';
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

const counter_slice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => { state.value += 1; },
    set: (state, action) => { state.value = action.payload; },
  },
});

const theme_slice = createSlice({
  name: 'theme',
  initialState: { mode: 'light' as string },
  reducers: {
    setMode: (state, action) => { state.mode = action.payload; },
  },
});

function createTestStore(channel: string, options?: Parameters<typeof tabSyncEnhancer>[0]) {
  return configureStore({
    reducer: {
      counter: counter_slice.reducer,
      theme: theme_slice.reducer,
    },
    enhancers: (getDefault) =>
      getDefault().concat(
        tabSyncEnhancer({ channel, ...options }),
      ),
  });
}

async function flushSync() {
  vi.advanceTimersByTime(20);
  await vi.advanceTimersByTimeAsync(0);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('tabSyncEnhancer — basic store', () => {
  it('creates a store with initial state intact', () => {
    const store = createTestStore('basic-1');
    const state = store.getState();

    expect(state.counter.value).toBe(0);
    expect(state.theme.mode).toBe('light');
  });

  it('local dispatch works correctly', () => {
    const store = createTestStore('basic-2');

    store.dispatch(counter_slice.actions.increment());
    expect(store.getState().counter.value).toBe(1);

    store.dispatch(theme_slice.actions.setMode('dark'));
    expect(store.getState().theme.mode).toBe('dark');
  });
});

describe('tabSyncEnhancer — cross-tab sync', () => {
  it('syncs state changes from store A to store B', async () => {
    const store_a = createTestStore('sync-1');
    const store_b = createTestStore('sync-1');

    store_a.dispatch(counter_slice.actions.increment());
    await flushSync();

    expect(store_b.getState().counter.value).toBe(1);
  });

  it('syncs multiple slices', async () => {
    const store_a = createTestStore('sync-2');
    const store_b = createTestStore('sync-2');

    store_a.dispatch(counter_slice.actions.set(42));
    store_a.dispatch(theme_slice.actions.setMode('dark'));
    await flushSync();

    expect(store_b.getState().counter.value).toBe(42);
    expect(store_b.getState().theme.mode).toBe('dark');
  });

  it('syncs bidirectionally', async () => {
    const store_a = createTestStore('sync-3');
    const store_b = createTestStore('sync-3');

    store_a.dispatch(counter_slice.actions.set(10));
    await flushSync();
    expect(store_b.getState().counter.value).toBe(10);

    store_b.dispatch(theme_slice.actions.setMode('dark'));
    await flushSync();
    expect(store_a.getState().theme.mode).toBe('dark');
  });
});

describe('tabSyncEnhancer — include/exclude', () => {
  it('only syncs keys listed in include', async () => {
    const store_a = createTestStore('filter-1', { include: ['counter'] });
    const store_b = createTestStore('filter-1', { include: ['counter'] });

    store_a.dispatch(counter_slice.actions.set(99));
    store_a.dispatch(theme_slice.actions.setMode('dark'));
    await flushSync();

    expect(store_b.getState().counter.value).toBe(99);
    expect(store_b.getState().theme.mode).toBe('light');
  });

  it('excludes keys listed in exclude', async () => {
    const store_a = createTestStore('filter-2', { exclude: ['theme'] });
    const store_b = createTestStore('filter-2', { exclude: ['theme'] });

    store_a.dispatch(counter_slice.actions.set(50));
    store_a.dispatch(theme_slice.actions.setMode('dark'));
    await flushSync();

    expect(store_b.getState().counter.value).toBe(50);
    expect(store_b.getState().theme.mode).toBe('light');
  });

  it('throws when both include and exclude are provided', () => {
    expect(() => {
      createTestStore('filter-err', {
        include: ['counter'],
        exclude: ['theme'],
      } as never);
    }).toThrow('`include` and `exclude` are mutually exclusive');
  });
});

describe('tabSyncEnhancer — onSyncReady', () => {
  it('invokes onSyncReady with the tab-bridge instance', () => {
    let captured_instance: TabSyncInstance<Record<string, unknown>> | null = null;

    createTestStore('ready-1', {
      onSyncReady: (instance) => { captured_instance = instance; },
    });

    expect(captured_instance).not.toBeNull();
    expect(typeof captured_instance!.id).toBe('string');
    expect(typeof captured_instance!.destroy).toBe('function');

    captured_instance!.destroy();
  });
});

describe('tabSyncEnhancer — no circular updates', () => {
  it('does not re-broadcast remote state changes', async () => {
    let instance_a: TabSyncInstance<Record<string, unknown>> | null = null;
    const store_a = createTestStore('circular-1', {
      onSyncReady: (i) => { instance_a = i; },
    });
    const store_b = createTestStore('circular-1');

    const subscribe_spy = vi.fn();
    store_b.subscribe(subscribe_spy);

    store_a.dispatch(counter_slice.actions.set(7));
    await flushSync();

    const count_after = subscribe_spy.mock.calls.length;

    await flushSync();
    await flushSync();

    expect(subscribe_spy.mock.calls.length).toBe(count_after);

    instance_a?.destroy();
  });
});

describe('tabSyncEnhancer — merge action', () => {
  it('exposes TAB_SYNC_MERGE_ACTION constant', () => {
    expect(TAB_SYNC_MERGE_ACTION).toBe('@@tab-bridge/MERGE');
  });
});
