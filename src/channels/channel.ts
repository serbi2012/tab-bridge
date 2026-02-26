import type { TabMessage } from '../types';
import { BroadcastChannelTransport } from './broadcast';
import { StorageChannel } from './storage';

export interface Channel {
  postMessage(message: TabMessage): void;
  onMessage(callback: (message: TabMessage) => void): () => void;
  close(): void;
}

export function createChannel(
  channelName: string,
  transport?: 'broadcast-channel' | 'local-storage',
): Channel {
  if (transport === 'local-storage') {
    return new StorageChannel(channelName);
  }

  if (transport === 'broadcast-channel') {
    return new BroadcastChannelTransport(channelName);
  }

  // Auto-detect: prefer BroadcastChannel, fall back to localStorage
  if (typeof BroadcastChannel !== 'undefined') {
    return new BroadcastChannelTransport(channelName);
  }

  return new StorageChannel(channelName);
}
