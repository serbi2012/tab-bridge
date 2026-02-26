import type { TabMessage, TabInfo, TabAnnouncePayload, SendFn } from '../types';
import { monotonic } from '../utils/timestamp';
import { isBrowser, hasDocument } from '../utils/env';

export interface TabRegistryOptions {
  send: SendFn;
  tabId: string;
  tabCreatedAt: number;
  /** Interval (ms) to check for dead tabs. Default: `2000` */
  heartbeatInterval?: number;
  /** How long (ms) before a tab is considered dead. Default: `6000` */
  tabTimeout?: number;
}

export class TabRegistry {
  private readonly tabs = new Map<string, TabInfo>();
  private readonly tabChangeListeners = new Set<(tabs: TabInfo[]) => void>();
  private readonly send: SendFn;
  private readonly tabId: string;
  private readonly tabCreatedAt: number;
  private readonly heartbeatInterval: number;
  private readonly tabTimeout: number;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private unloadHandler: (() => void) | null = null;

  constructor(options: TabRegistryOptions) {
    this.send = options.send;
    this.tabId = options.tabId;
    this.tabCreatedAt = options.tabCreatedAt;
    this.heartbeatInterval = options.heartbeatInterval ?? 2000;
    this.tabTimeout = options.tabTimeout ?? 6000;

    this.registerSelf();
    this.startHeartbeat();
    this.startPruning();
    this.listenVisibility();
    this.listenUnload();
  }

  // ── Public API ──

  getTabs(): TabInfo[] {
    return Array.from(this.tabs.values());
  }

  getTabCount(): number {
    return this.tabs.size;
  }

  getTab(id: string): TabInfo | undefined {
    return this.tabs.get(id);
  }

  onTabChange(callback: (tabs: TabInfo[]) => void): () => void {
    this.tabChangeListeners.add(callback);
    return () => {
      this.tabChangeListeners.delete(callback);
    };
  }

  announce(): void {
    this.send({
      type: 'TAB_ANNOUNCE',
      senderId: this.tabId,
      timestamp: monotonic(),
      payload: this.buildAnnouncePayload(),
    } as TabMessage);
  }

  handleMessage(message: TabMessage): void {
    switch (message.type) {
      case 'TAB_ANNOUNCE':
        this.handleAnnounce(message.senderId, message.payload);
        break;
      case 'TAB_GOODBYE':
        this.handleGoodbye(message.senderId);
        break;
      case 'LEADER_HEARTBEAT':
      case 'STATE_UPDATE':
      case 'LEADER_CLAIM':
      case 'LEADER_ACK':
        this.touchTab(message.senderId);
        break;
    }
  }

  setLeader(tabId: string | null): void {
    let changed = false;
    for (const [id, info] of this.tabs) {
      const wasLeader = info.isLeader;
      const isNowLeader = id === tabId;
      if (wasLeader !== isNowLeader) {
        this.tabs.set(id, { ...info, isLeader: isNowLeader });
        changed = true;
      }
    }
    if (changed) this.notifyChange();
  }

  destroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.visibilityHandler && hasDocument) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    if (this.unloadHandler && isBrowser) {
      window.removeEventListener('beforeunload', this.unloadHandler);
    }

    this.sendGoodbye();
    this.tabs.clear();
    this.tabChangeListeners.clear();
  }

  // ── Private ──

  private registerSelf(): void {
    this.tabs.set(this.tabId, {
      id: this.tabId,
      createdAt: this.tabCreatedAt,
      lastSeen: Date.now(),
      isLeader: false,
      isActive: hasDocument ? document.visibilityState === 'visible' : true,
      url: isBrowser ? location.href : '',
      title: hasDocument ? document.title : undefined,
    });
  }

  private buildAnnouncePayload(): TabAnnouncePayload {
    return {
      createdAt: this.tabCreatedAt,
      isActive: hasDocument ? document.visibilityState === 'visible' : true,
      url: isBrowser ? location.href : '',
      title: hasDocument ? document.title : undefined,
    };
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.touchSelf();
      this.announce();
    }, this.heartbeatInterval);
  }

  private startPruning(): void {
    this.pruneTimer = setInterval(() => {
      this.pruneDeadTabs();
    }, this.heartbeatInterval);
  }

  private listenVisibility(): void {
    if (!hasDocument) return;
    this.visibilityHandler = () => {
      const self = this.tabs.get(this.tabId);
      if (self) {
        const isActive = document.visibilityState === 'visible';
        this.tabs.set(this.tabId, { ...self, isActive, lastSeen: Date.now() });
        this.announce();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private listenUnload(): void {
    if (!isBrowser) return;
    this.unloadHandler = () => this.sendGoodbye();
    window.addEventListener('beforeunload', this.unloadHandler);
  }

  private sendGoodbye(): void {
    this.send({
      type: 'TAB_GOODBYE',
      senderId: this.tabId,
      timestamp: monotonic(),
      payload: null,
    } as TabMessage);
  }

  private handleAnnounce(senderId: string, payload: TabAnnouncePayload): void {
    const existing = this.tabs.get(senderId);
    this.tabs.set(senderId, {
      id: senderId,
      createdAt: payload.createdAt,
      lastSeen: Date.now(),
      isLeader: existing?.isLeader ?? false,
      isActive: payload.isActive,
      url: payload.url,
      title: payload.title,
    });
    this.notifyChange();
  }

  private handleGoodbye(senderId: string): void {
    if (this.tabs.delete(senderId)) {
      this.notifyChange();
    }
  }

  private touchTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      this.tabs.set(tabId, { ...tab, lastSeen: Date.now() });
    }
  }

  private touchSelf(): void {
    const self = this.tabs.get(this.tabId);
    if (self) {
      this.tabs.set(this.tabId, { ...self, lastSeen: Date.now() });
    }
  }

  private pruneDeadTabs(): void {
    const now = Date.now();
    let changed = false;

    for (const [id, info] of this.tabs) {
      if (id === this.tabId) continue;
      if (now - info.lastSeen > this.tabTimeout) {
        this.tabs.delete(id);
        changed = true;
      }
    }

    if (changed) this.notifyChange();
  }

  private notifyChange(): void {
    if (this.tabChangeListeners.size === 0) return;
    const tabs = this.getTabs();
    for (const cb of this.tabChangeListeners) {
      cb(tabs);
    }
  }
}
