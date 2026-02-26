import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TabMessage } from '../types';
import { BroadcastChannelTransport } from './broadcast';

// jsdom doesn't ship BroadcastChannel, so we provide a minimal mock
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
        listener(event);
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
    const set = MockBroadcastChannel.instances.get(this.name);
    if (set) set.delete(this);
    this.listeners = [];
  }

  static reset() {
    MockBroadcastChannel.instances.clear();
  }
}

const originalBC = globalThis.BroadcastChannel;

beforeEach(() => {
  MockBroadcastChannel.reset();
  (globalThis as Record<string, unknown>).BroadcastChannel =
    MockBroadcastChannel as unknown as typeof BroadcastChannel;
});

afterEach(() => {
  if (originalBC) {
    globalThis.BroadcastChannel = originalBC;
  } else {
    delete (globalThis as Record<string, unknown>).BroadcastChannel;
  }
});

function makeMessage(type: TabMessage['type'], senderId: string): TabMessage {
  return { type, senderId, timestamp: Date.now(), payload: null };
}

describe('BroadcastChannelTransport', () => {
  it('delivers messages between two channels', () => {
    const a = new BroadcastChannelTransport('test');
    const b = new BroadcastChannelTransport('test');

    const received: TabMessage[] = [];
    b.onMessage((msg) => received.push(msg));

    const msg = makeMessage('TAB_ANNOUNCE', 'tab-a');
    a.postMessage(msg);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(msg);

    a.close();
    b.close();
  });

  it('does not receive own messages', () => {
    const a = new BroadcastChannelTransport('test');
    const received: TabMessage[] = [];
    a.onMessage((msg) => received.push(msg));

    a.postMessage(makeMessage('TAB_ANNOUNCE', 'tab-a'));

    expect(received).toHaveLength(0);
    a.close();
  });

  it('does not cross channel names', () => {
    const a = new BroadcastChannelTransport('ch-1');
    const b = new BroadcastChannelTransport('ch-2');

    const received: TabMessage[] = [];
    b.onMessage((msg) => received.push(msg));

    a.postMessage(makeMessage('TAB_ANNOUNCE', 'tab-a'));

    expect(received).toHaveLength(0);
    a.close();
    b.close();
  });

  it('unsubscribe stops delivery', () => {
    const a = new BroadcastChannelTransport('test');
    const b = new BroadcastChannelTransport('test');

    const received: TabMessage[] = [];
    const unsub = b.onMessage((msg) => received.push(msg));

    a.postMessage(makeMessage('TAB_ANNOUNCE', 'tab-a'));
    expect(received).toHaveLength(1);

    unsub();

    a.postMessage(makeMessage('TAB_GOODBYE', 'tab-a'));
    expect(received).toHaveLength(1);

    a.close();
    b.close();
  });

  it('ignores postMessage after close', () => {
    const a = new BroadcastChannelTransport('test');
    const b = new BroadcastChannelTransport('test');

    const received: TabMessage[] = [];
    b.onMessage((msg) => received.push(msg));

    a.close();
    a.postMessage(makeMessage('TAB_ANNOUNCE', 'tab-a'));

    expect(received).toHaveLength(0);
    b.close();
  });

  it('supports multiple listeners', () => {
    const a = new BroadcastChannelTransport('test');
    const b = new BroadcastChannelTransport('test');

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    b.onMessage(cb1);
    b.onMessage(cb2);

    a.postMessage(makeMessage('TAB_ANNOUNCE', 'tab-a'));

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);

    a.close();
    b.close();
  });
});
