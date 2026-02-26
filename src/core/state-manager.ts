import type {
  TabMessage,
  MessageOf,
  ChangeMeta,
  StateUpdatePayload,
  StateSyncResponsePayload,
  SendFn,
} from '../types';
import { monotonic } from '../utils/timestamp';
import { createBatcher, type Batcher } from '../utils/batch';

interface StateEntry {
  value: unknown;
  timestamp: number;
}

export interface StateManagerOptions<TState extends Record<string, unknown>> {
  send: SendFn;
  tabId: string;
  initial?: TState;
  merge?: (localValue: unknown, remoteValue: unknown, key: keyof TState) => unknown;
  /**
   * Hook called before a remote value is applied.
   * Return `false` to reject, `{ value }` to transform, or `void` to accept.
   */
  interceptRemote?: (
    key: keyof TState,
    value: unknown,
    previousValue: unknown,
    meta: ChangeMeta,
  ) => { value: unknown } | false | void;
  /** Hook called after any remote change is committed. */
  afterRemoteChange?: (key: keyof TState, value: unknown, meta: ChangeMeta) => void;
}

export class StateManager<TState extends Record<string, unknown>> {
  private readonly state = new Map<string, StateEntry>();
  private readonly keyListeners = new Map<
    string,
    Set<(value: unknown, meta: ChangeMeta) => void>
  >();
  private readonly changeListeners = new Set<
    (state: Readonly<TState>, changedKeys: (keyof TState)[], meta: ChangeMeta) => void
  >();
  private readonly send: SendFn;
  private readonly tabId: string;
  private readonly mergeFn?: StateManagerOptions<TState>['merge'];
  private readonly interceptRemote?: StateManagerOptions<TState>['interceptRemote'];
  private readonly afterRemoteChange?: StateManagerOptions<TState>['afterRemoteChange'];
  private readonly batcher: Batcher<StateEntry>;
  private snapshotCache: Readonly<TState> | null = null;

  constructor(options: StateManagerOptions<TState>) {
    this.send = options.send;
    this.tabId = options.tabId;
    this.mergeFn = options.merge;
    this.interceptRemote = options.interceptRemote;
    this.afterRemoteChange = options.afterRemoteChange;

    if (options.initial) {
      for (const [key, value] of Object.entries(options.initial)) {
        this.state.set(key, { value, timestamp: 0 });
      }
    }

    this.batcher = createBatcher<StateEntry>((entries) => {
      const payload: StateUpdatePayload = { entries: {} };
      for (const [key, entry] of entries) {
        payload.entries[key] = { value: entry.value, timestamp: entry.timestamp };
      }
      this.send({
        type: 'STATE_UPDATE',
        senderId: this.tabId,
        timestamp: monotonic(),
        payload,
      } as TabMessage);
    });
  }

  // ── Read ──

  get<K extends keyof TState>(key: K): TState[K] {
    return this.state.get(key as string)?.value as TState[K];
  }

  /**
   * Returns a cached snapshot. The same reference is returned until state
   * changes, making this safe for React's `useSyncExternalStore`.
   */
  getAll(): Readonly<TState> {
    if (!this.snapshotCache) {
      const result: Record<string, unknown> = {};
      for (const [key, entry] of this.state) {
        result[key] = entry.value;
      }
      this.snapshotCache = result as Readonly<TState>;
    }
    return this.snapshotCache;
  }

  // ── Write ──

  set<K extends keyof TState>(key: K, value: TState[K]): void {
    const timestamp = monotonic();
    const k = key as string;

    this.state.set(k, { value, timestamp });
    this.snapshotCache = null;

    const meta: ChangeMeta = { sourceTabId: this.tabId, isLocal: true, timestamp };
    this.notifyKey(k, value, meta);
    this.notifyChange([key], meta);

    this.batcher.add(k, { value, timestamp });
  }

  patch(partial: Partial<TState>): void {
    const entries = Object.entries(partial);
    if (entries.length === 0) return;

    const timestamp = monotonic();
    const changedKeys: (keyof TState)[] = [];

    for (const [key, value] of entries) {
      this.state.set(key, { value, timestamp });
      changedKeys.push(key as keyof TState);
      this.batcher.add(key, { value, timestamp });
    }
    this.snapshotCache = null;

    const meta: ChangeMeta = { sourceTabId: this.tabId, isLocal: true, timestamp };
    for (const key of changedKeys) {
      this.notifyKey(key as string, this.state.get(key as string)!.value, meta);
    }
    this.notifyChange(changedKeys, meta);
  }

  // ── Subscriptions ──

  on<K extends keyof TState>(
    key: K,
    callback: (value: TState[K], meta: ChangeMeta) => void,
  ): () => void {
    const k = key as string;
    let set = this.keyListeners.get(k);
    if (!set) {
      set = new Set();
      this.keyListeners.set(k, set);
    }
    set.add(callback as (value: unknown, meta: ChangeMeta) => void);
    return () => {
      set!.delete(callback as (value: unknown, meta: ChangeMeta) => void);
    };
  }

  onChange(
    callback: (
      state: Readonly<TState>,
      changedKeys: (keyof TState)[],
      meta: ChangeMeta,
    ) => void,
  ): () => void {
    this.changeListeners.add(callback);
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  // ── Incoming messages ──

  handleMessage(message: TabMessage): void {
    switch (message.type) {
      case 'STATE_UPDATE':
        this.applyRemoteUpdate(message);
        break;
      case 'STATE_SYNC_RESPONSE':
        if (!message.targetId || message.targetId === this.tabId) {
          this.applySyncResponse(message);
        }
        break;
    }
  }

  // ── Sync protocol ──

  requestSync(): void {
    this.send({
      type: 'STATE_SYNC_REQUEST',
      senderId: this.tabId,
      timestamp: monotonic(),
      payload: null,
    } as TabMessage);
  }

  respondToSync(targetId: string): void {
    const state: Record<string, StateEntry> = {};
    for (const [key, entry] of this.state) {
      state[key] = { value: entry.value, timestamp: entry.timestamp };
    }
    this.send({
      type: 'STATE_SYNC_RESPONSE',
      senderId: this.tabId,
      targetId,
      timestamp: monotonic(),
      payload: { state } satisfies StateSyncResponsePayload,
    } as TabMessage);
  }

  flush(): void {
    this.batcher.flush();
  }

  destroy(): void {
    this.batcher.destroy();
    this.keyListeners.clear();
    this.changeListeners.clear();
  }

  // ── Private ──

  private applyRemoteUpdate(message: MessageOf<'STATE_UPDATE'>): void {
    const { entries } = message.payload;
    const changedKeys: (keyof TState)[] = [];
    const meta: ChangeMeta = {
      sourceTabId: message.senderId,
      isLocal: false,
      timestamp: message.timestamp,
    };

    for (const [key, remote] of Object.entries(entries)) {
      const local = this.state.get(key);

      let finalValue: unknown;
      if (this.mergeFn) {
        finalValue = this.mergeFn(local?.value, remote.value, key as keyof TState);
      } else if (this.shouldAcceptRemote(local, remote, message.senderId)) {
        finalValue = remote.value;
      } else {
        continue;
      }

      // Run intercept hook (middleware integration point)
      if (this.interceptRemote) {
        const result = this.interceptRemote(
          key as keyof TState,
          finalValue,
          local?.value,
          meta,
        );
        if (result === false) continue;
        if (result && 'value' in result) finalValue = result.value;
      }

      this.state.set(key, { value: finalValue, timestamp: remote.timestamp });
      changedKeys.push(key as keyof TState);
    }

    if (changedKeys.length > 0) {
      this.snapshotCache = null;
      for (const key of changedKeys) {
        const val = this.state.get(key as string)!.value;
        this.notifyKey(key as string, val, meta);
        this.afterRemoteChange?.(key, val, meta);
      }
      this.notifyChange(changedKeys, meta);
    }
  }

  /** LWW: accept remote if newer timestamp, or same timestamp with higher senderId. */
  private shouldAcceptRemote(
    local: StateEntry | undefined,
    remote: { value: unknown; timestamp: number },
    remoteSenderId: string,
  ): boolean {
    if (!local) return true;
    if (remote.timestamp > local.timestamp) return true;
    if (remote.timestamp === local.timestamp) return remoteSenderId > this.tabId;
    return false;
  }

  private applySyncResponse(message: MessageOf<'STATE_SYNC_RESPONSE'>): void {
    const { state } = message.payload;
    const changedKeys: (keyof TState)[] = [];
    const meta: ChangeMeta = {
      sourceTabId: message.senderId,
      isLocal: false,
      timestamp: message.timestamp,
    };

    for (const [key, remote] of Object.entries(state)) {
      const local = this.state.get(key);
      if (!local || remote.timestamp > local.timestamp) {
        this.state.set(key, { value: remote.value, timestamp: remote.timestamp });
        changedKeys.push(key as keyof TState);
      }
    }

    if (changedKeys.length > 0) {
      this.snapshotCache = null;
      for (const key of changedKeys) {
        const val = this.state.get(key as string)!.value;
        this.notifyKey(key as string, val, meta);
        this.afterRemoteChange?.(key, val, meta);
      }
      this.notifyChange(changedKeys, meta);
    }
  }

  private notifyKey(key: string, value: unknown, meta: ChangeMeta): void {
    const listeners = this.keyListeners.get(key);
    if (!listeners) return;
    for (const cb of listeners) {
      cb(value, meta);
    }
  }

  private notifyChange(changedKeys: (keyof TState)[], meta: ChangeMeta): void {
    if (this.changeListeners.size === 0) return;
    const snapshot = this.getAll();
    for (const cb of this.changeListeners) {
      cb(snapshot, changedKeys, meta);
    }
  }
}
