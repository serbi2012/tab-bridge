import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TabMessage, LeaderClaimPayload } from '../types';
import { LeaderElection } from './leader-election';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function createElection(
  tabId: string,
  tabCreatedAt: number,
  opts?: { electionTimeout?: number; heartbeatInterval?: number; missedHeartbeatsLimit?: number },
) {
  const sent: TabMessage[] = [];
  const send = (msg: TabMessage) => sent.push(msg);

  const le = new LeaderElection({
    send,
    tabId,
    tabCreatedAt,
    electionTimeout: opts?.electionTimeout ?? 300,
    heartbeatInterval: opts?.heartbeatInterval ?? 2000,
    missedHeartbeatsLimit: opts?.missedHeartbeatsLimit ?? 3,
  });

  return { le, sent };
}

function claimMsg(senderId: string, createdAt: number): TabMessage {
  return {
    type: 'LEADER_CLAIM',
    senderId,
    timestamp: Date.now(),
    payload: { createdAt } satisfies LeaderClaimPayload,
  };
}

function ackMsg(senderId: string): TabMessage {
  return { type: 'LEADER_ACK', senderId, timestamp: Date.now(), payload: null };
}

function heartbeatMsg(senderId: string): TabMessage {
  return { type: 'LEADER_HEARTBEAT', senderId, timestamp: Date.now(), payload: null };
}

function resignMsg(senderId: string): TabMessage {
  return { type: 'LEADER_RESIGN', senderId, timestamp: Date.now(), payload: null };
}

// ── Single-tab scenario ──

describe('LeaderElection — single tab', () => {
  it('becomes leader after election timeout', () => {
    const { le, sent } = createElection('tab-1', 1000);
    le.start();

    expect(le.isLeader()).toBe(false);
    const claims = sent.filter((m) => m.type === 'LEADER_CLAIM');
    expect(claims).toHaveLength(1);

    vi.advanceTimersByTime(300);

    expect(le.isLeader()).toBe(true);
    expect(le.getLeaderId()).toBe('tab-1');

    const acks = sent.filter((m) => m.type === 'LEADER_ACK');
    expect(acks).toHaveLength(1);

    le.destroy();
  });

  it('fires onLeader callback when elected', () => {
    const { le } = createElection('tab-1', 1000);
    const cb = vi.fn();
    le.onLeader(cb);
    le.start();

    vi.advanceTimersByTime(300);
    expect(cb).toHaveBeenCalledTimes(1);

    le.destroy();
  });

  it('fires cleanup when leadership is lost via destroy', () => {
    const cleanup = vi.fn();
    const { le } = createElection('tab-1', 1000);
    le.onLeader(() => cleanup);
    le.start();

    vi.advanceTimersByTime(300);
    expect(le.isLeader()).toBe(true);

    le.destroy();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

// ── Multi-tab election ──

describe('LeaderElection — multi-tab', () => {
  it('older tab wins the election', () => {
    const { le: le1 } = createElection('tab-1', 1000);
    const { le: le2 } = createElection('tab-2', 2000);

    le1.start();
    le2.start();

    // tab-2 receives tab-1's claim (older → higher priority)
    le2.handleMessage(claimMsg('tab-1', 1000));
    // tab-1 receives tab-2's claim (newer → lower priority)
    le1.handleMessage(claimMsg('tab-2', 2000));

    vi.advanceTimersByTime(300);

    expect(le1.isLeader()).toBe(true);
    expect(le2.isLeader()).toBe(false);

    // tab-2 receives LEADER_ACK from tab-1
    le2.handleMessage(ackMsg('tab-1'));
    expect(le2.getLeaderId()).toBe('tab-1');

    le1.destroy();
    le2.destroy();
  });

  it('tiebreaks by tabId when createdAt is equal', () => {
    const { le: leA } = createElection('aaa', 1000);
    const { le: leB } = createElection('zzz', 1000);

    leA.start();
    leB.start();

    leB.handleMessage(claimMsg('aaa', 1000));
    leA.handleMessage(claimMsg('zzz', 1000));

    vi.advanceTimersByTime(300);

    // 'aaa' < 'zzz' → aaa has priority
    expect(leA.isLeader()).toBe(true);
    expect(leB.isLeader()).toBe(false);

    leA.destroy();
    leB.destroy();
  });

  it('new tab accepts existing leader via heartbeat', () => {
    const { le } = createElection('tab-new', 5000);
    le.start();

    // Before election timeout, receive heartbeat from existing leader
    le.handleMessage(heartbeatMsg('tab-leader'));

    expect(le.getLeaderId()).toBe('tab-leader');
    expect(le.isLeader()).toBe(false);

    le.destroy();
  });

  it('accepts leader via LEADER_ACK', () => {
    const { le } = createElection('tab-2', 2000);
    le.start();

    le.handleMessage(ackMsg('tab-1'));

    expect(le.getLeaderId()).toBe('tab-1');
    expect(le.isLeader()).toBe(false);

    le.destroy();
  });
});

// ── Heartbeat & failure detection ──

describe('LeaderElection — heartbeat', () => {
  it('leader sends periodic heartbeats', () => {
    const { le, sent } = createElection('tab-1', 1000, { heartbeatInterval: 1000 });
    le.start();
    vi.advanceTimersByTime(300);
    expect(le.isLeader()).toBe(true);

    sent.length = 0;
    vi.advanceTimersByTime(3000);

    const heartbeats = sent.filter((m) => m.type === 'LEADER_HEARTBEAT');
    expect(heartbeats.length).toBeGreaterThanOrEqual(2);

    le.destroy();
  });

  it('detects leader failure and triggers re-election', () => {
    const { le, sent } = createElection('tab-2', 2000, {
      heartbeatInterval: 1000,
      missedHeartbeatsLimit: 3,
    });
    le.start();

    // Immediately accept a leader
    le.handleMessage(ackMsg('tab-1'));
    expect(le.getLeaderId()).toBe('tab-1');

    // No heartbeats for 3000ms (3 × 1000ms)
    vi.advanceTimersByTime(4000);

    // Should have started re-election
    const claims = sent.filter((m) => m.type === 'LEADER_CLAIM');
    expect(claims.length).toBeGreaterThanOrEqual(1);

    // After election timeout, tab-2 becomes leader
    vi.advanceTimersByTime(300);
    expect(le.isLeader()).toBe(true);

    le.destroy();
  });
});

// ── Resign ──

describe('LeaderElection — resign', () => {
  it('triggers re-election when leader resigns', () => {
    const { le, sent } = createElection('tab-2', 2000);
    le.start();
    le.handleMessage(ackMsg('tab-1'));
    expect(le.getLeaderId()).toBe('tab-1');

    sent.length = 0;
    le.handleMessage(resignMsg('tab-1'));

    const claims = sent.filter((m) => m.type === 'LEADER_CLAIM');
    expect(claims.length).toBeGreaterThanOrEqual(1);

    vi.advanceTimersByTime(300);
    expect(le.isLeader()).toBe(true);

    le.destroy();
  });

  it('sends LEADER_RESIGN on destroy if leader', () => {
    const { le, sent } = createElection('tab-1', 1000);
    le.start();
    vi.advanceTimersByTime(300);
    expect(le.isLeader()).toBe(true);

    sent.length = 0;
    le.destroy();

    const resigns = sent.filter((m) => m.type === 'LEADER_RESIGN');
    expect(resigns).toHaveLength(1);
  });

  it('does not send LEADER_RESIGN on destroy if not leader', () => {
    const { le, sent } = createElection('tab-2', 2000);
    le.start();
    le.handleMessage(ackMsg('tab-1'));

    sent.length = 0;
    le.destroy();

    const resigns = sent.filter((m) => m.type === 'LEADER_RESIGN');
    expect(resigns).toHaveLength(0);
  });
});

// ── onLeader lifecycle ──

describe('LeaderElection — onLeader', () => {
  it('invokes callback immediately if already leader', () => {
    const { le } = createElection('tab-1', 1000);
    le.start();
    vi.advanceTimersByTime(300);

    const cb = vi.fn();
    le.onLeader(cb);
    expect(cb).toHaveBeenCalledTimes(1);

    le.destroy();
  });

  it('unsubscribe prevents future invocations and runs cleanup', () => {
    const cleanup = vi.fn();
    const { le } = createElection('tab-1', 1000);

    const unsub = le.onLeader(() => cleanup);
    le.start();
    vi.advanceTimersByTime(300);
    expect(cleanup).not.toHaveBeenCalled();

    unsub();
    expect(cleanup).toHaveBeenCalledTimes(1);

    le.destroy();
  });
});
