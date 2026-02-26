import type { TabMessage } from '../types';
import type { Channel } from './channel';

export class BroadcastChannelTransport implements Channel {
  private bc: BroadcastChannel;
  private closed = false;

  constructor(channelName: string) {
    this.bc = new BroadcastChannel(channelName);
  }

  postMessage(message: TabMessage): void {
    if (this.closed) return;
    this.bc.postMessage(message);
  }

  onMessage(callback: (message: TabMessage) => void): () => void {
    const handler = (event: MessageEvent<TabMessage>) => {
      callback(event.data);
    };
    this.bc.addEventListener('message', handler);
    return () => this.bc.removeEventListener('message', handler);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.bc.close();
  }
}
