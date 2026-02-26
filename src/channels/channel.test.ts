import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createChannel } from './channel';
import { StorageChannel } from './storage';
import { BroadcastChannelTransport } from './broadcast';

// Minimal mock so BroadcastChannel exists in jsdom
class MockBroadcastChannel {
  static instances = new Map<string, Set<MockBroadcastChannel>>();
  name: string;
  private listeners: Array<(e: MessageEvent) => void> = [];

  constructor(name: string) {
    this.name = name;
    const set = MockBroadcastChannel.instances.get(name) ?? new Set();
    set.add(this);
    MockBroadcastChannel.instances.set(name, set);
  }
  postMessage(data: unknown) {
    const peers = MockBroadcastChannel.instances.get(this.name);
    if (!peers) return;
    for (const p of peers) {
      if (p === this) continue;
      const e = new MessageEvent('message', { data });
      p.listeners.forEach((l) => l(e));
    }
  }
  addEventListener(_: string, l: (e: MessageEvent) => void) { this.listeners.push(l); }
  removeEventListener(_: string, l: (e: MessageEvent) => void) {
    this.listeners = this.listeners.filter((x) => x !== l);
  }
  close() {
    MockBroadcastChannel.instances.get(this.name)?.delete(this);
    this.listeners = [];
  }
  static reset() { MockBroadcastChannel.instances.clear(); }
}

const originalBC = globalThis.BroadcastChannel;

describe('createChannel', () => {
  afterEach(() => {
    MockBroadcastChannel.reset();
    if (originalBC) {
      globalThis.BroadcastChannel = originalBC;
    } else {
      delete (globalThis as Record<string, unknown>).BroadcastChannel;
    }
  });

  it('returns StorageChannel when forced to local-storage', () => {
    const ch = createChannel('test', 'local-storage');
    expect(ch).toBeInstanceOf(StorageChannel);
    ch.close();
  });

  it('returns BroadcastChannelTransport when forced to broadcast-channel', () => {
    (globalThis as Record<string, unknown>).BroadcastChannel = MockBroadcastChannel;
    const ch = createChannel('test', 'broadcast-channel');
    expect(ch).toBeInstanceOf(BroadcastChannelTransport);
    ch.close();
  });

  it('auto-selects BroadcastChannel when available', () => {
    (globalThis as Record<string, unknown>).BroadcastChannel = MockBroadcastChannel;
    const ch = createChannel('test');
    expect(ch).toBeInstanceOf(BroadcastChannelTransport);
    ch.close();
  });

  it('falls back to StorageChannel when BroadcastChannel is unavailable', () => {
    delete (globalThis as Record<string, unknown>).BroadcastChannel;
    const ch = createChannel('test');
    expect(ch).toBeInstanceOf(StorageChannel);
    ch.close();
  });
});
