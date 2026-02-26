import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TabMessage, TabInfo } from '../types';
import { TabRegistry } from './tab-registry';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function createTestRegistry(tabId = 'tab-1', opts?: { heartbeatInterval?: number; tabTimeout?: number }) {
  const sent: TabMessage[] = [];
  const send = (msg: TabMessage) => sent.push(msg);

  const registry = new TabRegistry({
    send,
    tabId,
    heartbeatInterval: opts?.heartbeatInterval ?? 2000,
    tabTimeout: opts?.tabTimeout ?? 6000,
  });

  return { registry, sent };
}

function announceMsg(senderId: string, overrides?: Partial<TabInfo>): TabMessage {
  return {
    type: 'TAB_ANNOUNCE',
    senderId,
    timestamp: Date.now(),
    payload: {
      id: senderId,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      isLeader: false,
      isActive: true,
      url: 'http://localhost',
      ...overrides,
    } satisfies TabInfo,
  };
}

describe('TabRegistry — self registration', () => {
  it('registers itself on creation', () => {
    const { registry } = createTestRegistry('tab-1');
    expect(registry.getTabCount()).toBe(1);

    const self = registry.getTab('tab-1');
    expect(self).toBeDefined();
    expect(self!.id).toBe('tab-1');

    registry.destroy();
  });

  it('includes self in getTabs()', () => {
    const { registry } = createTestRegistry('tab-1');
    const tabs = registry.getTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe('tab-1');
    registry.destroy();
  });
});

describe('TabRegistry — TAB_ANNOUNCE / TAB_GOODBYE', () => {
  it('adds a tab on TAB_ANNOUNCE', () => {
    const { registry } = createTestRegistry();

    registry.handleMessage(announceMsg('tab-2'));

    expect(registry.getTabCount()).toBe(2);
    expect(registry.getTab('tab-2')).toBeDefined();
    registry.destroy();
  });

  it('updates existing tab on repeated TAB_ANNOUNCE', () => {
    const { registry } = createTestRegistry();

    registry.handleMessage(announceMsg('tab-2', { isActive: true }));
    registry.handleMessage(announceMsg('tab-2', { isActive: false }));

    expect(registry.getTabCount()).toBe(2);
    expect(registry.getTab('tab-2')!.isActive).toBe(false);
    registry.destroy();
  });

  it('removes a tab on TAB_GOODBYE', () => {
    const { registry } = createTestRegistry();
    registry.handleMessage(announceMsg('tab-2'));
    expect(registry.getTabCount()).toBe(2);

    registry.handleMessage({
      type: 'TAB_GOODBYE',
      senderId: 'tab-2',
      timestamp: Date.now(),
      payload: null,
    });

    expect(registry.getTabCount()).toBe(1);
    expect(registry.getTab('tab-2')).toBeUndefined();
    registry.destroy();
  });

  it('fires onTabChange when a tab joins', () => {
    const { registry } = createTestRegistry();
    const cb = vi.fn();
    registry.onTabChange(cb);

    registry.handleMessage(announceMsg('tab-2'));

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toHaveLength(2);
    registry.destroy();
  });

  it('fires onTabChange when a tab leaves', () => {
    const { registry } = createTestRegistry();
    registry.handleMessage(announceMsg('tab-2'));

    const cb = vi.fn();
    registry.onTabChange(cb);

    registry.handleMessage({
      type: 'TAB_GOODBYE',
      senderId: 'tab-2',
      timestamp: Date.now(),
      payload: null,
    });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toHaveLength(1);
    registry.destroy();
  });

  it('unsubscribe stops onTabChange', () => {
    const { registry } = createTestRegistry();
    const cb = vi.fn();
    const unsub = registry.onTabChange(cb);

    registry.handleMessage(announceMsg('tab-2'));
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
    registry.handleMessage(announceMsg('tab-3'));
    expect(cb).toHaveBeenCalledTimes(1);
    registry.destroy();
  });
});

describe('TabRegistry — heartbeat & pruning', () => {
  it('sends TAB_ANNOUNCE periodically as heartbeat', () => {
    const { registry, sent } = createTestRegistry('tab-1', { heartbeatInterval: 1000 });

    vi.advanceTimersByTime(1000);
    const announces = sent.filter((m) => m.type === 'TAB_ANNOUNCE');
    expect(announces.length).toBeGreaterThanOrEqual(1);

    registry.destroy();
  });

  it('prunes tabs that exceed timeout', () => {
    const { registry } = createTestRegistry('tab-1', {
      heartbeatInterval: 1000,
      tabTimeout: 3000,
    });

    registry.handleMessage(announceMsg('tab-2'));
    expect(registry.getTabCount()).toBe(2);

    // Advance past timeout without tab-2 sending anything
    vi.advanceTimersByTime(4000);

    expect(registry.getTabCount()).toBe(1);
    expect(registry.getTab('tab-2')).toBeUndefined();

    registry.destroy();
  });

  it('does not prune self', () => {
    const { registry } = createTestRegistry('tab-1', {
      heartbeatInterval: 1000,
      tabTimeout: 3000,
    });

    vi.advanceTimersByTime(10000);
    expect(registry.getTab('tab-1')).toBeDefined();

    registry.destroy();
  });

  it('touching tab via other message types resets lastSeen', () => {
    const { registry } = createTestRegistry('tab-1', {
      heartbeatInterval: 1000,
      tabTimeout: 3000,
    });

    registry.handleMessage(announceMsg('tab-2'));

    // Advance 2s, then send a STATE_UPDATE from tab-2 (touch)
    vi.advanceTimersByTime(2000);
    registry.handleMessage({
      type: 'STATE_UPDATE',
      senderId: 'tab-2',
      timestamp: Date.now(),
      payload: { entries: {} },
    });

    // Advance another 2s — tab-2 should still be alive (total 4s but lastSeen reset at 2s)
    vi.advanceTimersByTime(2000);
    expect(registry.getTab('tab-2')).toBeDefined();

    registry.destroy();
  });
});

describe('TabRegistry — setLeader', () => {
  it('marks a tab as leader', () => {
    const { registry } = createTestRegistry();
    registry.handleMessage(announceMsg('tab-2'));

    registry.setLeader('tab-2');

    expect(registry.getTab('tab-2')!.isLeader).toBe(true);
    expect(registry.getTab('tab-1')!.isLeader).toBe(false);
    registry.destroy();
  });

  it('clears previous leader when setting new one', () => {
    const { registry } = createTestRegistry();
    registry.handleMessage(announceMsg('tab-2'));
    registry.handleMessage(announceMsg('tab-3'));

    registry.setLeader('tab-2');
    expect(registry.getTab('tab-2')!.isLeader).toBe(true);

    registry.setLeader('tab-3');
    expect(registry.getTab('tab-2')!.isLeader).toBe(false);
    expect(registry.getTab('tab-3')!.isLeader).toBe(true);

    registry.destroy();
  });

  it('setLeader(null) clears all leaders', () => {
    const { registry } = createTestRegistry();
    registry.setLeader('tab-1');
    expect(registry.getTab('tab-1')!.isLeader).toBe(true);

    registry.setLeader(null);
    expect(registry.getTab('tab-1')!.isLeader).toBe(false);

    registry.destroy();
  });
});

describe('TabRegistry — destroy', () => {
  it('sends TAB_GOODBYE on destroy', () => {
    const { registry, sent } = createTestRegistry();
    registry.destroy();

    const goodbyes = sent.filter((m) => m.type === 'TAB_GOODBYE');
    expect(goodbyes.length).toBeGreaterThanOrEqual(1);
  });

  it('clears all tabs and listeners', () => {
    const { registry } = createTestRegistry();
    const cb = vi.fn();
    registry.onTabChange(cb);

    registry.destroy();

    expect(registry.getTabCount()).toBe(0);
  });
});
