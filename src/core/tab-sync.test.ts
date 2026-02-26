import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TabMessage } from '../types';
import { createTabSync } from './tab-sync';

// Mock BroadcastChannel with cross-instance delivery
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
        // Simulate async delivery like real BroadcastChannel
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

const originalBC = globalThis.BroadcastChannel;

beforeEach(() => {
  vi.useFakeTimers();
  MockBroadcastChannel.reset();
  (globalThis as Record<string, unknown>).BroadcastChannel = MockBroadcastChannel;
});

afterEach(() => {
  vi.useRealTimers();
  if (originalBC) {
    globalThis.BroadcastChannel = originalBC;
  } else {
    delete (globalThis as Record<string, unknown>).BroadcastChannel;
  }
});

interface AppState extends Record<string, unknown> {
  theme: string;
  count: number;
}

describe('createTabSync — basic API', () => {
  it('returns a valid instance with all expected properties', () => {
    const sync = createTabSync<AppState>({ initial: { theme: 'light', count: 0 } });

    expect(sync.id).toBeDefined();
    expect(sync.ready).toBe(true);
    expect(typeof sync.get).toBe('function');
    expect(typeof sync.set).toBe('function');
    expect(typeof sync.patch).toBe('function');
    expect(typeof sync.on).toBe('function');
    expect(typeof sync.onChange).toBe('function');
    expect(typeof sync.isLeader).toBe('function');
    expect(typeof sync.onLeader).toBe('function');
    expect(typeof sync.getTabs).toBe('function');
    expect(typeof sync.call).toBe('function');
    expect(typeof sync.handle).toBe('function');
    expect(typeof sync.destroy).toBe('function');

    sync.destroy();
  });

  it('get/set/getAll work on initial state', () => {
    const sync = createTabSync<AppState>({ initial: { theme: 'light', count: 0 } });

    expect(sync.get('theme')).toBe('light');
    expect(sync.get('count')).toBe(0);
    expect(sync.getAll()).toEqual({ theme: 'light', count: 0 });

    sync.set('theme', 'dark');
    expect(sync.get('theme')).toBe('dark');

    sync.destroy();
  });

  it('patch updates multiple keys', () => {
    const sync = createTabSync<AppState>({ initial: { theme: 'light', count: 0 } });

    sync.patch({ theme: 'dark', count: 5 });
    expect(sync.getAll()).toEqual({ theme: 'dark', count: 5 });

    sync.destroy();
  });
});

describe('createTabSync — subscriptions', () => {
  it('on(key) fires on local set', () => {
    const sync = createTabSync<AppState>({ initial: { theme: 'light', count: 0 } });
    const cb = vi.fn();
    sync.on('theme', cb);

    sync.set('theme', 'dark');
    expect(cb).toHaveBeenCalledWith('dark', expect.objectContaining({ isLocal: true }));

    sync.destroy();
  });

  it('onChange fires with snapshot and changed keys', () => {
    const sync = createTabSync<AppState>({ initial: { theme: 'light', count: 0 } });
    const cb = vi.fn();
    sync.onChange(cb);

    sync.set('count', 42);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ count: 42 }),
      ['count'],
      expect.any(Object),
    );

    sync.destroy();
  });
});

describe('createTabSync — cross-tab state sync', () => {
  it('syncs state between two tabs', async () => {
    const tab1 = createTabSync<AppState>({
      initial: { theme: 'light', count: 0 },
      channel: 'test-sync',
    });
    const tab2 = createTabSync<AppState>({
      initial: { theme: 'light', count: 0 },
      channel: 'test-sync',
    });

    const cb = vi.fn();
    tab2.on('theme', cb);

    tab1.set('theme', 'dark');

    // Flush batch timer
    vi.advanceTimersByTime(20);
    // Process microtask queue for async message delivery
    await vi.advanceTimersByTimeAsync(0);

    expect(cb).toHaveBeenCalledWith('dark', expect.objectContaining({ isLocal: false }));
    expect(tab2.get('theme')).toBe('dark');

    tab1.destroy();
    tab2.destroy();
  });
});

describe('createTabSync — leader election', () => {
  it('single tab becomes leader', () => {
    const sync = createTabSync<AppState>({
      initial: { theme: 'light', count: 0 },
      channel: 'test-leader',
    });

    // After election timeout
    vi.advanceTimersByTime(500);
    expect(sync.isLeader()).toBe(true);

    sync.destroy();
  });

  it('onLeader callback fires when elected', () => {
    const cb = vi.fn();
    const sync = createTabSync<AppState>({
      initial: { theme: 'light', count: 0 },
      channel: 'test-leader2',
    });

    sync.onLeader(cb);
    vi.advanceTimersByTime(500);

    expect(cb).toHaveBeenCalled();
    sync.destroy();
  });

  it('leader election disabled returns true for isLeader', () => {
    const sync = createTabSync<AppState>({
      initial: { theme: 'light', count: 0 },
      leader: false,
      channel: 'test-no-leader',
    });

    expect(sync.isLeader()).toBe(true);
    sync.destroy();
  });
});

describe('createTabSync — tab registry', () => {
  it('tracks self in tab list', () => {
    const sync = createTabSync<AppState>({
      initial: { theme: 'light', count: 0 },
      channel: 'test-tabs',
    });

    expect(sync.getTabCount()).toBe(1);
    expect(sync.getTabs()[0].id).toBe(sync.id);

    sync.destroy();
  });
});

describe('createTabSync — RPC', () => {
  it('call and handle work across tabs', async () => {
    const tab1 = createTabSync<AppState>({
      initial: { theme: 'light', count: 0 },
      channel: 'test-rpc',
    });
    const tab2 = createTabSync<AppState>({
      initial: { theme: 'light', count: 0 },
      channel: 'test-rpc',
    });

    tab2.handle('double', (n: number) => n * 2);

    const promise = tab1.call<number>(tab2.id, 'double', 21);

    // Let messages flow
    await vi.advanceTimersByTimeAsync(10);

    expect(await promise).toBe(42);

    tab1.destroy();
    tab2.destroy();
  });
});

describe('createTabSync — destroy', () => {
  it('sets ready to false', () => {
    const sync = createTabSync<AppState>({ initial: { theme: 'light', count: 0 } });
    expect(sync.ready).toBe(true);

    sync.destroy();
    expect(sync.ready).toBe(false);
  });

  it('double destroy is safe', () => {
    const sync = createTabSync<AppState>({ initial: { theme: 'light', count: 0 } });
    sync.destroy();
    expect(() => sync.destroy()).not.toThrow();
  });
});
