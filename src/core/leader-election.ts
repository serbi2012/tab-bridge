import type { TabMessage, LeaderClaimPayload, SendFn } from '../types';
import { monotonic } from '../utils/timestamp';

export interface LeaderElectionOptions {
  send: SendFn;
  tabId: string;
  tabCreatedAt: number;
  /** Time (ms) to wait for a higher-priority claim before becoming leader. Default: `300` */
  electionTimeout?: number;
  /** Heartbeat interval (ms). Default: `2000` */
  heartbeatInterval?: number;
  /** How many missed heartbeats before declaring leader dead. Default: `3` */
  missedHeartbeatsLimit?: number;
}

export class LeaderElection {
  private readonly send: SendFn;
  private readonly tabId: string;
  private readonly tabCreatedAt: number;
  private readonly electionTimeout: number;
  private readonly heartbeatInterval: number;
  private readonly leaderTimeout: number;

  private leaderId: string | null = null;
  private electionTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private leaderWatchTimer: ReturnType<typeof setInterval> | null = null;
  private lastLeaderHeartbeat = 0;
  private electing = false;

  private readonly leaderCallbacks = new Set<() => void | (() => void)>();
  private readonly leaderCleanups = new Map<() => void | (() => void), () => void>();

  constructor(options: LeaderElectionOptions) {
    this.send = options.send;
    this.tabId = options.tabId;
    this.tabCreatedAt = options.tabCreatedAt;
    this.electionTimeout = options.electionTimeout ?? 300;
    this.heartbeatInterval = options.heartbeatInterval ?? 2000;

    const missedLimit = options.missedHeartbeatsLimit ?? 3;
    this.leaderTimeout = this.heartbeatInterval * missedLimit;
  }

  // ── Public API ──

  isLeader(): boolean {
    return this.leaderId === this.tabId;
  }

  getLeaderId(): string | null {
    return this.leaderId;
  }

  onLeader(callback: () => void | (() => void)): () => void {
    this.leaderCallbacks.add(callback);

    if (this.isLeader()) {
      const cleanup = callback();
      if (typeof cleanup === 'function') {
        this.leaderCleanups.set(callback, cleanup);
      }
    }

    return () => {
      this.leaderCallbacks.delete(callback);
      const cleanup = this.leaderCleanups.get(callback);
      if (cleanup) {
        cleanup();
        this.leaderCleanups.delete(callback);
      }
    };
  }

  start(): void {
    this.startElection();
    this.startLeaderWatch();
  }

  handleMessage(message: TabMessage): void {
    switch (message.type) {
      case 'LEADER_CLAIM':
        this.handleClaim(message.payload as LeaderClaimPayload, message.senderId);
        break;
      case 'LEADER_ACK':
        this.handleAck(message.senderId);
        break;
      case 'LEADER_HEARTBEAT':
        this.handleHeartbeat(message.senderId);
        break;
      case 'LEADER_RESIGN':
        this.handleResign(message.senderId);
        break;
    }
  }

  destroy(): void {
    if (this.isLeader()) {
      this.send({
        type: 'LEADER_RESIGN',
        senderId: this.tabId,
        timestamp: monotonic(),
        payload: null,
      } as TabMessage);
    }
    this.clearElectionTimer();
    this.clearHeartbeat();
    this.clearLeaderWatch();
    this.runCleanups();
    this.leaderCallbacks.clear();
    this.leaderId = null;
  }

  // ── Election ──

  private startElection(): void {
    if (this.electing) return;
    this.electing = true;

    this.send({
      type: 'LEADER_CLAIM',
      senderId: this.tabId,
      timestamp: monotonic(),
      payload: { createdAt: this.tabCreatedAt } satisfies LeaderClaimPayload,
    } as TabMessage);

    this.electionTimer = setTimeout(() => {
      this.electionTimer = null;
      this.electing = false;
      this.becomeLeader();
    }, this.electionTimeout);
  }

  private handleClaim(payload: LeaderClaimPayload, senderId: string): void {
    if (this.hasPriority(payload.createdAt, senderId)) {
      if (!this.electing) this.startElection();
    } else {
      this.clearElectionTimer();
      this.electing = false;
    }
  }

  private handleAck(senderId: string): void {
    this.clearElectionTimer();
    this.electing = false;
    this.setLeader(senderId);
  }

  private handleHeartbeat(senderId: string): void {
    if (senderId === this.leaderId || !this.leaderId) {
      this.setLeader(senderId);
    }
    this.lastLeaderHeartbeat = Date.now();
  }

  private handleResign(senderId: string): void {
    if (senderId === this.leaderId) {
      this.leaderId = null;
      this.runCleanups();
      this.startElection();
    }
  }

  private becomeLeader(): void {
    this.setLeader(this.tabId);

    this.send({
      type: 'LEADER_ACK',
      senderId: this.tabId,
      timestamp: monotonic(),
      payload: null,
    } as TabMessage);

    this.startHeartbeat();
  }

  private setLeader(id: string): void {
    const wasLeader = this.isLeader();
    this.leaderId = id;
    this.lastLeaderHeartbeat = Date.now();

    if (this.isLeader() && !wasLeader) {
      this.startHeartbeat();
      for (const cb of this.leaderCallbacks) {
        const cleanup = cb();
        if (typeof cleanup === 'function') {
          this.leaderCleanups.set(cb, cleanup);
        }
      }
    } else if (!this.isLeader() && wasLeader) {
      this.clearHeartbeat();
      this.runCleanups();
    }
  }

  /**
   * Priority: oldest tab (smaller `createdAt`) wins.
   * Tiebreak: lower `tabId` wins (deterministic).
   */
  private hasPriority(remoteCreatedAt: number, remoteTabId: string): boolean {
    if (this.tabCreatedAt < remoteCreatedAt) return true;
    if (this.tabCreatedAt > remoteCreatedAt) return false;
    return this.tabId < remoteTabId;
  }

  // ── Heartbeat ──

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isLeader()) return;
      this.send({
        type: 'LEADER_HEARTBEAT',
        senderId: this.tabId,
        timestamp: monotonic(),
        payload: null,
      } as TabMessage);
    }, this.heartbeatInterval);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── Leader Watch ──

  private startLeaderWatch(): void {
    this.lastLeaderHeartbeat = Date.now();
    this.leaderWatchTimer = setInterval(() => {
      if (this.isLeader()) return;
      if (this.leaderId && Date.now() - this.lastLeaderHeartbeat > this.leaderTimeout) {
        this.leaderId = null;
        this.runCleanups();
        this.startElection();
      }
    }, this.heartbeatInterval);
  }

  private clearLeaderWatch(): void {
    if (this.leaderWatchTimer) {
      clearInterval(this.leaderWatchTimer);
      this.leaderWatchTimer = null;
    }
  }

  private clearElectionTimer(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }
  }

  private runCleanups(): void {
    for (const cleanup of this.leaderCleanups.values()) {
      cleanup();
    }
    this.leaderCleanups.clear();
  }
}
