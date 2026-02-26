import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TabMessage } from '../types';
import { StorageChannel } from './storage';

function makeMessage(type: TabMessage['type'], senderId: string): TabMessage {
  return { type, senderId, timestamp: Date.now(), payload: null };
}

/**
 * Simulate what the browser does when another tab writes to localStorage:
 * fire a StorageEvent on `window` with the given key and value.
 */
function fireStorageEvent(key: string, newValue: string | null) {
  const event = new StorageEvent('storage', { key, newValue });
  window.dispatchEvent(event);
}

describe('StorageChannel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('serializes and writes to localStorage on postMessage', () => {
    const ch = new StorageChannel('test');
    const msg = makeMessage('TAB_ANNOUNCE', 'tab-a');

    ch.postMessage(msg);

    const raw = localStorage.getItem('__tab_sync__test');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.m).toEqual(msg);

    ch.close();
  });

  it('receives messages via storage event', () => {
    const ch = new StorageChannel('test');
    const received: TabMessage[] = [];
    ch.onMessage((msg) => received.push(msg));

    const msg = makeMessage('STATE_UPDATE', 'tab-b');
    const wrapped = JSON.stringify({ m: msg, s: 0 });
    fireStorageEvent('__tab_sync__test', wrapped);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(msg);

    ch.close();
  });

  it('ignores storage events for other keys', () => {
    const ch = new StorageChannel('test');
    const received: TabMessage[] = [];
    ch.onMessage((msg) => received.push(msg));

    const msg = makeMessage('TAB_ANNOUNCE', 'tab-b');
    const wrapped = JSON.stringify({ m: msg, s: 0 });
    fireStorageEvent('__tab_sync__other', wrapped);

    expect(received).toHaveLength(0);
    ch.close();
  });

  it('ignores storage events with null value', () => {
    const ch = new StorageChannel('test');
    const received: TabMessage[] = [];
    ch.onMessage((msg) => received.push(msg));

    fireStorageEvent('__tab_sync__test', null);

    expect(received).toHaveLength(0);
    ch.close();
  });

  it('ignores malformed JSON', () => {
    const ch = new StorageChannel('test');
    const received: TabMessage[] = [];
    ch.onMessage((msg) => received.push(msg));

    fireStorageEvent('__tab_sync__test', '{invalid json');

    expect(received).toHaveLength(0);
    ch.close();
  });

  it('unsubscribe stops delivery', () => {
    const ch = new StorageChannel('test');
    const received: TabMessage[] = [];
    const unsub = ch.onMessage((msg) => received.push(msg));

    const msg1 = makeMessage('TAB_ANNOUNCE', 'tab-b');
    fireStorageEvent('__tab_sync__test', JSON.stringify({ m: msg1, s: 0 }));
    expect(received).toHaveLength(1);

    unsub();

    const msg2 = makeMessage('TAB_GOODBYE', 'tab-b');
    fireStorageEvent('__tab_sync__test', JSON.stringify({ m: msg2, s: 1 }));
    expect(received).toHaveLength(1);

    ch.close();
  });

  it('close removes all listeners and cleans up localStorage', () => {
    const ch = new StorageChannel('test');
    const cb = vi.fn();
    ch.onMessage(cb);

    ch.postMessage(makeMessage('TAB_ANNOUNCE', 'tab-a'));
    expect(localStorage.getItem('__tab_sync__test')).not.toBeNull();

    ch.close();

    expect(localStorage.getItem('__tab_sync__test')).toBeNull();

    const msg = makeMessage('STATE_UPDATE', 'tab-b');
    fireStorageEvent('__tab_sync__test', JSON.stringify({ m: msg, s: 0 }));
    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores postMessage after close', () => {
    const ch = new StorageChannel('test');
    ch.close();

    ch.postMessage(makeMessage('TAB_ANNOUNCE', 'tab-a'));
    expect(localStorage.getItem('__tab_sync__test')).toBeNull();
  });

  it('uses incrementing sequence to ensure unique values', () => {
    const ch = new StorageChannel('test');
    const msg = makeMessage('STATE_UPDATE', 'tab-a');

    ch.postMessage(msg);
    const raw1 = localStorage.getItem('__tab_sync__test');

    ch.postMessage(msg);
    const raw2 = localStorage.getItem('__tab_sync__test');

    expect(raw1).not.toBe(raw2);
    ch.close();
  });
});
