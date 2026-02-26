// ═══════════════════════════════════════════════════════════════════════════════
// tab-sync — Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export const PROTOCOL_VERSION = 1;

// ── Message Payloads ────────────────────────────────────────────────────────

export interface StateUpdatePayload {
  entries: Record<string, { value: unknown; timestamp: number }>;
}

export interface StateSyncResponsePayload {
  state: Record<string, { value: unknown; timestamp: number }>;
}

export interface LeaderClaimPayload {
  createdAt: number;
}

export interface TabAnnouncePayload {
  createdAt: number;
  isActive: boolean;
  url: string;
  title?: string;
}

export interface RpcRequestPayload {
  callId: string;
  method: string;
  args: unknown;
}

export interface RpcResponsePayload {
  callId: string;
  result?: unknown;
  error?: string;
}

// ── Discriminated-Union Message System ──────────────────────────────────────

/**
 * Maps every message type to its exact payload shape.
 * Adding a new message only requires extending this interface.
 */
export interface MessagePayloadMap {
  STATE_UPDATE: StateUpdatePayload;
  STATE_SYNC_REQUEST: null;
  STATE_SYNC_RESPONSE: StateSyncResponsePayload;
  LEADER_CLAIM: LeaderClaimPayload;
  LEADER_ACK: null;
  LEADER_HEARTBEAT: null;
  LEADER_RESIGN: null;
  TAB_ANNOUNCE: TabAnnouncePayload;
  TAB_GOODBYE: null;
  RPC_REQUEST: RpcRequestPayload;
  RPC_RESPONSE: RpcResponsePayload;
}

export type MessageType = keyof MessagePayloadMap;

/**
 * Discriminated union of all inter-tab messages.
 *
 * Checking `msg.type` narrows `msg.payload` to the exact payload type,
 * eliminating the need for runtime casts:
 *
 * ```ts
 * if (msg.type === 'STATE_UPDATE') {
 *   msg.payload.entries; // ← StateUpdatePayload, fully typed
 * }
 * ```
 */
export type TabMessage = {
  [K in MessageType]: {
    readonly type: K;
    readonly senderId: string;
    readonly targetId?: string;
    readonly timestamp: number;
    readonly version?: number;
    readonly payload: MessagePayloadMap[K];
  };
}[MessageType];

/** Extract a single message variant by its type discriminant. */
export type MessageOf<T extends MessageType> = Extract<TabMessage, { type: T }>;

/** Function that sends a message through the transport channel. */
export type SendFn = (message: TabMessage) => void;

// ── Tab Info ────────────────────────────────────────────────────────────────

export interface TabInfo {
  id: string;
  createdAt: number;
  lastSeen: number;
  isLeader: boolean;
  isActive: boolean;
  url: string;
  title?: string;
}

// ── Change Metadata ─────────────────────────────────────────────────────────

export interface ChangeMeta {
  readonly sourceTabId: string;
  readonly isLocal: boolean;
  readonly timestamp: number;
}

// ── Middleware ───────────────────────────────────────────────────────────────

export interface MiddlewareContext<TState extends Record<string, unknown>> {
  readonly key: keyof TState;
  readonly value: unknown;
  readonly previousValue: unknown;
  readonly meta: ChangeMeta;
}

/**
 * Return `false` to reject the change, `{ value }` to transform it,
 * or `void`/`undefined` to pass through unchanged.
 */
export type MiddlewareResult = { value: unknown } | false;

export interface Middleware<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly name: string;
  /** Intercept local `set` / `patch` calls before they are applied. */
  onSet?: (ctx: MiddlewareContext<TState>) => MiddlewareResult | void;
  /** Called after any state change (local or remote) has been committed. */
  afterChange?: (key: keyof TState, value: unknown, meta: ChangeMeta) => void;
  /** Cleanup when the instance is destroyed. */
  onDestroy?: () => void;
}

// ── Persistence ─────────────────────────────────────────────────────────────

export interface PersistOptions<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Storage key. Default: `'tab-sync:state'` */
  key?: string;
  /** Only persist these keys (whitelist). */
  include?: (keyof TState)[];
  /** Exclude these keys from persistence (blacklist). */
  exclude?: (keyof TState)[];
  /** Custom serializer. Default: `JSON.stringify` */
  serialize?: (state: Partial<TState>) => string;
  /** Custom deserializer. Default: `JSON.parse` */
  deserialize?: (raw: string) => Partial<TState>;
  /** Debounce persistence writes in ms. Default: `100` */
  debounce?: number;
  /** Custom storage backend. Default: `localStorage` */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

// ── Typed RPC ───────────────────────────────────────────────────────────────

/**
 * Define your RPC contract for full type inference:
 *
 * ```ts
 * interface MyRPC {
 *   getTime: { args: void; result: { iso: string } };
 *   add:     { args: { a: number; b: number }; result: number };
 * }
 *
 * const sync = createTabSync<State, MyRPC>({ ... });
 * const { iso } = await sync.call('leader', 'getTime');  // fully typed
 * ```
 */
export type RPCMap = Record<string, { args: unknown; result: unknown }>;

/** Resolve args type for a method. Falls back to `unknown` for unregistered methods. */
export type RPCArgs<TMap extends RPCMap, M extends string> =
  M extends keyof TMap ? TMap[M]['args'] : unknown;

/** Resolve result type for a method. Falls back to `unknown` for unregistered methods. */
export type RPCResult<TMap extends RPCMap, M extends string> =
  M extends keyof TMap ? TMap[M]['result'] : unknown;

// ── Options ─────────────────────────────────────────────────────────────────

export interface LeaderOptions {
  /** Heartbeat interval in ms. Default: `2000` */
  heartbeatInterval?: number;
  /** Leader timeout in ms. Default: `6000` */
  leaderTimeout?: number;
}

export interface TabSyncOptions<
  TState extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Initial state used before sync completes. */
  initial?: TState;
  /** Channel name — only tabs sharing the same name communicate. Default: `'tab-sync'` */
  channel?: string;
  /** Force a specific transport layer. Default: auto-detect. */
  transport?: 'broadcast-channel' | 'local-storage';
  /** Custom merge function for LWW conflict resolution. */
  merge?: (localValue: unknown, remoteValue: unknown, key: keyof TState) => unknown;
  /** Enable leader election. Default: `true` */
  leader?: boolean | LeaderOptions;
  /** Heartbeat interval in ms. Default: `2000` */
  heartbeatInterval?: number;
  /** Leader timeout in ms. Default: `6000` */
  leaderTimeout?: number;
  /** Enable debug logging. Default: `false` */
  debug?: boolean;
  /** Persist state across page reloads. `true` uses defaults, or pass options. */
  persist?: PersistOptions<TState> | boolean;
  /** Middleware pipeline for intercepting state changes. */
  middlewares?: Middleware<TState>[];
  /** Error callback for non-fatal errors (storage, channel, etc.). */
  onError?: (error: Error) => void;
}

// ── Instance ────────────────────────────────────────────────────────────────

export interface TabSyncInstance<
  TState extends Record<string, unknown>,
  TRPCMap extends RPCMap = RPCMap,
> {
  // ── State ──

  /** Read a single value by key. */
  get<K extends keyof TState>(key: K): TState[K];

  /**
   * Read the entire state as a frozen snapshot.
   * Returns the same reference until state changes (safe for React).
   */
  getAll(): Readonly<TState>;

  /** Update a single key. Synced to all tabs. */
  set<K extends keyof TState>(key: K, value: TState[K]): void;

  /** Update multiple keys in a single broadcast. */
  patch(partial: Partial<TState>): void;

  // ── Subscriptions ──

  /**
   * Subscribe to changes for a specific key.
   * @returns Unsubscribe function.
   *
   * ```ts
   * const off = sync.on('theme', (value, meta) => {
   *   console.log(value, meta.isLocal ? 'local' : 'remote');
   * });
   * off(); // unsubscribe
   * ```
   */
  on<K extends keyof TState>(
    key: K,
    callback: (value: TState[K], meta: ChangeMeta) => void,
  ): () => void;

  /**
   * Subscribe to a specific key, but fire only once then auto-unsubscribe.
   *
   * ```ts
   * sync.once('theme', (value) => console.log('First change:', value));
   * ```
   */
  once<K extends keyof TState>(
    key: K,
    callback: (value: TState[K], meta: ChangeMeta) => void,
  ): () => void;

  /**
   * Subscribe to all state changes.
   * @returns Unsubscribe function.
   */
  onChange(
    callback: (
      state: Readonly<TState>,
      changedKeys: (keyof TState)[],
      meta: ChangeMeta,
    ) => void,
  ): () => void;

  /**
   * Subscribe to a **derived value**. The callback only fires when the
   * selector's return value actually changes (compared via `isEqual`,
   * default `Object.is`).
   *
   * ```ts
   * sync.select(
   *   (s) => s.items.filter(i => i.done).length,
   *   (doneCount) => badge.textContent = doneCount,
   * );
   * ```
   *
   * @returns Unsubscribe function.
   */
  select<TResult>(
    selector: (state: Readonly<TState>) => TResult,
    callback: (result: TResult, meta: ChangeMeta) => void,
    isEqual?: (a: TResult, b: TResult) => boolean,
  ): () => void;

  // ── Leader ──

  /** Whether this tab is currently the leader. */
  isLeader(): boolean;

  /**
   * Register a callback that fires when this tab becomes leader.
   * Optionally return a cleanup function that runs when leadership is lost.
   *
   * ```ts
   * sync.onLeader(() => {
   *   const ws = new WebSocket('...');
   *   return () => ws.close(); // cleanup on resign
   * });
   * ```
   */
  onLeader(callback: () => void | (() => void)): () => void;

  /** Get info about the current leader tab, or `null` if no leader yet. */
  getLeader(): TabInfo | null;

  /**
   * Returns a promise that resolves with the leader's `TabInfo`
   * as soon as a leader is elected. Resolves immediately if a leader
   * already exists.
   *
   * ```ts
   * const leader = await sync.waitForLeader();
   * const result = await sync.call('leader', 'getData');
   * ```
   */
  waitForLeader(): Promise<TabInfo>;

  // ── Tabs ──

  /** Unique ID of this tab (UUID v4). */
  readonly id: string;

  /** List of all currently active tabs. */
  getTabs(): TabInfo[];

  /** Number of currently active tabs. */
  getTabCount(): number;

  /**
   * Subscribe to tab presence changes (join, leave, leader change).
   * @returns Unsubscribe function.
   */
  onTabChange(callback: (tabs: TabInfo[]) => void): () => void;

  // ── RPC (typed when TRPCMap is provided) ──

  /**
   * Call a remote procedure on another tab.
   *
   * ```ts
   * const result = await sync.call('leader', 'getTime');
   * const sum    = await sync.call(tabId, 'add', { a: 1, b: 2 });
   * ```
   *
   * @param target - Tab ID or `'leader'` to auto-resolve.
   * @param method - Method name (typed if `TRPCMap` is provided).
   * @param args   - Arguments to pass to the handler.
   * @param timeout - Timeout in ms. Default: `5000`.
   */
  call<M extends string>(
    target: string | 'leader',
    method: M,
    args?: RPCArgs<TRPCMap, M>,
    timeout?: number,
  ): Promise<RPCResult<TRPCMap, M>>;

  /**
   * Register an RPC handler that other tabs can call.
   *
   * ```ts
   * sync.handle('add', ({ a, b }) => a + b);
   * ```
   *
   * @returns Unsubscribe function to remove the handler.
   */
  handle<M extends string>(
    method: M,
    handler: (
      args: RPCArgs<TRPCMap, M>,
      callerTabId: string,
    ) => RPCResult<TRPCMap, M> | Promise<RPCResult<TRPCMap, M>>,
  ): () => void;

  // ── Lifecycle ──

  /**
   * Destroy this instance. Sends goodbye to other tabs,
   * cancels all timers, and flushes pending state.
   * Safe to call multiple times.
   */
  destroy(): void;

  /** `false` after `destroy()` has been called. */
  readonly ready: boolean;
}
