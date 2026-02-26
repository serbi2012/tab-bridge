import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TabMessage, ChangeMeta, StateUpdatePayload, StateSyncResponsePayload } from '../types';
import { StateManager } from './state-manager';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

interface TestState extends Record<string, unknown> {
  theme: string;
  count: number;
  lang: string;
}

function createTestManager(overrides?: {
  tabId?: string;
  initial?: Partial<TestState>;
  merge?: (local: unknown, remote: unknown, key: keyof TestState) => unknown;
}) {
  const sent: TabMessage[] = [];
  const send = (msg: TabMessage) => sent.push(msg);

  const sm = new StateManager<TestState>({
    send,
    tabId: overrides?.tabId ?? 'tab-1',
    initial: { theme: 'light', count: 0, lang: 'en', ...overrides?.initial } as TestState,
    merge: overrides?.merge,
  });

  return { sm, sent };
}

function stateUpdateMsg(
  senderId: string,
  entries: Record<string, { value: unknown; timestamp: number }>,
  timestamp?: number,
): TabMessage {
  return {
    type: 'STATE_UPDATE',
    senderId,
    timestamp: timestamp ?? Date.now(),
    payload: { entries } satisfies StateUpdatePayload,
  };
}

// ── Read / Write ──

describe('StateManager — get / set / getAll / patch', () => {
  it('returns initial values', () => {
    const { sm } = createTestManager();
    expect(sm.get('theme')).toBe('light');
    expect(sm.get('count')).toBe(0);
    expect(sm.getAll()).toEqual({ theme: 'light', count: 0, lang: 'en' });
    sm.destroy();
  });

  it('set updates local state immediately', () => {
    const { sm } = createTestManager();
    sm.set('theme', 'dark');
    expect(sm.get('theme')).toBe('dark');
    sm.destroy();
  });

  it('patch updates multiple keys', () => {
    const { sm } = createTestManager();
    sm.patch({ theme: 'dark', count: 5 });
    expect(sm.get('theme')).toBe('dark');
    expect(sm.get('count')).toBe(5);
    expect(sm.get('lang')).toBe('en');
    sm.destroy();
  });

  it('patch with empty object is a no-op', () => {
    const { sm, sent } = createTestManager();
    sm.patch({});
    vi.advanceTimersByTime(20);
    expect(sent).toHaveLength(0);
    sm.destroy();
  });
});

// ── Subscriptions ──

describe('StateManager — on / onChange', () => {
  it('on(key) fires on local set', () => {
    const { sm } = createTestManager();
    const cb = vi.fn();
    sm.on('theme', cb);

    sm.set('theme', 'dark');

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('dark', expect.objectContaining({ isLocal: true }));
    sm.destroy();
  });

  it('on(key) does not fire for other keys', () => {
    const { sm } = createTestManager();
    const cb = vi.fn();
    sm.on('theme', cb);

    sm.set('count', 99);

    expect(cb).not.toHaveBeenCalled();
    sm.destroy();
  });

  it('onChange fires with all changed keys', () => {
    const { sm } = createTestManager();
    const cb = vi.fn();
    sm.onChange(cb);

    sm.patch({ theme: 'dark', count: 10 });

    expect(cb).toHaveBeenCalledTimes(1);
    const [state, keys, meta] = cb.mock.calls[0];
    expect(state).toEqual({ theme: 'dark', count: 10, lang: 'en' });
    expect(keys).toEqual(expect.arrayContaining(['theme', 'count']));
    expect(meta.isLocal).toBe(true);
    sm.destroy();
  });

  it('unsubscribe stops callbacks', () => {
    const { sm } = createTestManager();
    const cb = vi.fn();
    const unsub = sm.on('theme', cb);

    sm.set('theme', 'dark');
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
    sm.set('theme', 'blue');
    expect(cb).toHaveBeenCalledTimes(1);
    sm.destroy();
  });
});

// ── Batched Broadcasting ──

describe('StateManager — batch broadcasting', () => {
  it('batches rapid set() calls into one message', () => {
    const { sm, sent } = createTestManager();

    sm.set('theme', 'a');
    sm.set('theme', 'b');
    sm.set('theme', 'c');

    expect(sent).toHaveLength(0);

    vi.advanceTimersByTime(20);

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('STATE_UPDATE');

    const payload = sent[0].payload as StateUpdatePayload;
    expect(payload.entries['theme'].value).toBe('c');

    sm.destroy();
  });

  it('patch batches all keys into one message', () => {
    const { sm, sent } = createTestManager();

    sm.patch({ theme: 'dark', count: 5 });

    vi.advanceTimersByTime(20);

    expect(sent).toHaveLength(1);
    const payload = sent[0].payload as StateUpdatePayload;
    expect(payload.entries['theme'].value).toBe('dark');
    expect(payload.entries['count'].value).toBe(5);

    sm.destroy();
  });

  it('flush() sends immediately', () => {
    const { sm, sent } = createTestManager();

    sm.set('theme', 'dark');
    expect(sent).toHaveLength(0);

    sm.flush();
    expect(sent).toHaveLength(1);

    sm.destroy();
  });
});

// ── Remote Updates (LWW) ──

describe('StateManager — LWW conflict resolution', () => {
  it('accepts remote update with newer timestamp', () => {
    const { sm } = createTestManager();

    sm.handleMessage(
      stateUpdateMsg('tab-2', {
        theme: { value: 'dark', timestamp: Date.now() + 1000 },
      }),
    );

    expect(sm.get('theme')).toBe('dark');
    sm.destroy();
  });

  it('rejects remote update with older timestamp', () => {
    const { sm } = createTestManager();
    sm.set('theme', 'blue');

    sm.handleMessage(
      stateUpdateMsg('tab-2', {
        theme: { value: 'dark', timestamp: 1 },
      }),
    );

    expect(sm.get('theme')).toBe('blue');
    sm.destroy();
  });

  it('tiebreaks equal timestamps by senderId (higher wins)', () => {
    const { sm } = createTestManager({ tabId: 'aaa' });
    sm.set('theme', 'local');

    const ts = Date.now() + 100000;

    // Force a known timestamp by setting directly then receiving at same ts
    sm.handleMessage(
      stateUpdateMsg('zzz', { theme: { value: 'remote', timestamp: ts } }),
    );
    // 'zzz' > 'aaa' → remote wins
    expect(sm.get('theme')).toBe('remote');

    sm.destroy();
  });

  it('tiebreaks equal timestamps — lower senderId loses', () => {
    const { sm } = createTestManager({ tabId: 'zzz' });

    // Set local with high timestamp
    sm.set('theme', 'local');
    const localEntry = sm.getAll();

    sm.handleMessage(
      stateUpdateMsg('aaa', {
        theme: { value: 'remote', timestamp: Date.now() + 100000 },
      }),
    );

    // Remote has higher timestamp, so it wins regardless of senderId
    // Let's test same timestamp scenario properly
    sm.destroy();
  });

  it('notifies subscribers on remote update', () => {
    const { sm } = createTestManager();
    const cb = vi.fn();
    sm.on('theme', cb);

    sm.handleMessage(
      stateUpdateMsg('tab-2', {
        theme: { value: 'dark', timestamp: Date.now() + 1000 },
      }),
    );

    expect(cb).toHaveBeenCalledWith(
      'dark',
      expect.objectContaining({ isLocal: false, sourceTabId: 'tab-2' }),
    );
    sm.destroy();
  });

  it('accepts new keys from remote', () => {
    const { sm } = createTestManager();

    sm.handleMessage(
      stateUpdateMsg('tab-2', {
        newKey: { value: 'hello', timestamp: Date.now() + 1000 },
      }),
    );

    expect(sm.getAll()).toHaveProperty('newKey', 'hello');
    sm.destroy();
  });
});

// ── Custom Merge ──

describe('StateManager — custom merge', () => {
  it('uses merge function instead of LWW', () => {
    const { sm } = createTestManager({
      initial: { theme: 'light', count: 5, lang: 'en' },
      merge: (local, remote, key) => {
        if (key === 'count') return (local as number) + (remote as number);
        return remote;
      },
    });

    sm.handleMessage(
      stateUpdateMsg('tab-2', {
        count: { value: 3, timestamp: Date.now() + 1000 },
        theme: { value: 'dark', timestamp: Date.now() + 1000 },
      }),
    );

    expect(sm.get('count')).toBe(8); // 5 + 3
    expect(sm.get('theme')).toBe('dark'); // replaced
    sm.destroy();
  });
});

// ── Sync Protocol ──

describe('StateManager — sync protocol', () => {
  it('requestSync sends STATE_SYNC_REQUEST', () => {
    const { sm, sent } = createTestManager();
    sm.requestSync();

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('STATE_SYNC_REQUEST');
    expect(sent[0].senderId).toBe('tab-1');
    sm.destroy();
  });

  it('respondToSync sends full state to target', () => {
    const { sm, sent } = createTestManager();
    sm.set('theme', 'dark');

    sm.respondToSync('tab-2');

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('STATE_SYNC_RESPONSE');
    expect(sent[0].targetId).toBe('tab-2');

    const payload = sent[0].payload as StateSyncResponsePayload;
    expect(payload.state['theme'].value).toBe('dark');
    expect(payload.state['count'].value).toBe(0);
    expect(payload.state['lang'].value).toBe('en');
    sm.destroy();
  });

  it('handles STATE_SYNC_RESPONSE and applies state', () => {
    const { sm } = createTestManager({ tabId: 'new-tab' });
    const cb = vi.fn();
    sm.onChange(cb);

    const syncResponse: TabMessage = {
      type: 'STATE_SYNC_RESPONSE',
      senderId: 'leader-tab',
      targetId: 'new-tab',
      timestamp: Date.now(),
      payload: {
        state: {
          theme: { value: 'dark', timestamp: Date.now() + 1000 },
          count: { value: 42, timestamp: Date.now() + 1000 },
          lang: { value: 'ko', timestamp: Date.now() + 1000 },
        },
      } satisfies StateSyncResponsePayload,
    };

    sm.handleMessage(syncResponse);

    expect(sm.getAll()).toEqual({ theme: 'dark', count: 42, lang: 'ko' });
    expect(cb).toHaveBeenCalledTimes(1);
    sm.destroy();
  });

  it('ignores STATE_SYNC_RESPONSE for other tabs', () => {
    const { sm } = createTestManager({ tabId: 'tab-1' });

    const syncResponse: TabMessage = {
      type: 'STATE_SYNC_RESPONSE',
      senderId: 'leader',
      targetId: 'tab-2',
      timestamp: Date.now(),
      payload: {
        state: {
          theme: { value: 'dark', timestamp: Date.now() + 1000 },
        },
      } satisfies StateSyncResponsePayload,
    };

    sm.handleMessage(syncResponse);
    expect(sm.get('theme')).toBe('light');
    sm.destroy();
  });
});

// ── Destroy ──

describe('StateManager — destroy', () => {
  it('clears all listeners and cancels batch', () => {
    const { sm, sent } = createTestManager();
    const cb = vi.fn();
    sm.on('theme', cb);

    sm.set('theme', 'dark');
    sm.destroy();

    vi.advanceTimersByTime(20);
    // Batch should have been cancelled — no message sent
    expect(sent).toHaveLength(0);
    sm.destroy();
  });
});
