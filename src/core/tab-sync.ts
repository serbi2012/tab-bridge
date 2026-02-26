import type {
  TabSyncOptions,
  TabSyncInstance,
  TabInfo,
  ChangeMeta,
  TabMessage,
  LeaderOptions,
  PersistOptions,
  Middleware,
  RPCMap,
  SendFn,
  PROTOCOL_VERSION as _PV,
} from '../types';
import { PROTOCOL_VERSION } from '../types';
import { generateTabId } from '../utils/id';
import { hasLocalStorage } from '../utils/env';
import { createChannel, type Channel } from '../channels/channel';
import { StateManager } from './state-manager';
import { TabRegistry } from './tab-registry';
import { LeaderElection } from './leader-election';
import { RPCHandler } from './rpc';
import { runMiddleware, notifyMiddleware, destroyMiddleware } from './middleware';

// ── Persistence Helpers ─────────────────────────────────────────────────────

function resolvePersistOptions<TState extends Record<string, unknown>>(
  opt: PersistOptions<TState> | boolean | undefined,
): PersistOptions<TState> | null {
  if (!opt) return null;
  if (opt === true) return {};
  return opt;
}

function loadPersistedState<TState extends Record<string, unknown>>(
  opts: PersistOptions<TState>,
): Partial<TState> {
  const storage = opts.storage ?? (hasLocalStorage ? localStorage : null);
  if (!storage) return {};
  const key = opts.key ?? 'tab-sync:state';
  const deserialize = opts.deserialize ?? JSON.parse;
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = deserialize(raw) as Partial<TState>;
    return filterPersistKeys(parsed, opts);
  } catch {
    return {};
  }
}

function filterPersistKeys<TState extends Record<string, unknown>>(
  state: Partial<TState>,
  opts: PersistOptions<TState>,
): Partial<TState> {
  const include = opts.include ? new Set(opts.include) : null;
  const exclude = opts.exclude ? new Set(opts.exclude) : null;
  const result: Partial<TState> = {};
  for (const [key, value] of Object.entries(state)) {
    const k = key as keyof TState;
    if (exclude?.has(k)) continue;
    if (include && !include.has(k)) continue;
    (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

function createPersistSaver<TState extends Record<string, unknown>>(
  opts: PersistOptions<TState>,
  onError: (e: Error) => void,
): { save: (state: Readonly<TState>) => void; flush: () => void; destroy: () => void } {
  const storage = opts.storage ?? (hasLocalStorage ? localStorage : null);
  if (!storage) return { save() {}, flush() {}, destroy() {} };

  const key = opts.key ?? 'tab-sync:state';
  const serialize = opts.serialize ?? JSON.stringify;
  const debounce = opts.debounce ?? 100;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestState: Readonly<TState> | null = null;

  function doSave() {
    if (!latestState) return;
    try {
      const filtered = filterPersistKeys({ ...latestState } as Partial<TState>, opts);
      storage!.setItem(key, serialize(filtered));
    } catch (e) {
      onError(e instanceof Error ? e : new Error(String(e)));
    }
    latestState = null;
  }

  return {
    save(state: Readonly<TState>) {
      latestState = state;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          doSave();
        }, debounce);
      }
    },
    flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      doSave();
    },
    destroy() {
      if (timer) { clearTimeout(timer); timer = null; }
      doSave();
    },
  };
}

// ── Debug Logger ────────────────────────────────────────────────────────────

function createLogger(enabled: boolean, tabId: string) {
  if (!enabled) return { log: (() => {}) as (...args: unknown[]) => void };
  const prefix = `%c[tab-sync:${tabId.slice(0, 8)}]`;
  const style = 'color:#818cf8;font-weight:600';
  return {
    log: (label: string, ...args: unknown[]) =>
      console.log(prefix, style, label, ...args),
  };
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createTabSync<
  TState extends Record<string, unknown> = Record<string, unknown>,
  TRPCMap extends RPCMap = RPCMap,
>(options?: TabSyncOptions<TState>): TabSyncInstance<TState, TRPCMap> {
  const opts = options ?? ({} as TabSyncOptions<TState>);
  const tabId = generateTabId();
  const tabCreatedAt = Date.now();
  const channelName = opts.channel ?? 'tab-sync';
  const debug = opts.debug ?? false;
  const onError = opts.onError ?? (() => {});

  // ── Leader options ──
  const leaderEnabled = opts.leader !== false;
  const leaderOpts: LeaderOptions =
    typeof opts.leader === 'object' ? opts.leader : {};
  const heartbeatInterval =
    opts.heartbeatInterval ?? leaderOpts.heartbeatInterval ?? 2000;
  const leaderTimeout =
    opts.leaderTimeout ?? leaderOpts.leaderTimeout ?? 6000;
  const missedHeartbeatsLimit = Math.max(
    1,
    Math.round(leaderTimeout / heartbeatInterval),
  );

  // ── Middleware ──
  const middlewares: Middleware<TState>[] = [...(opts.middlewares ?? [])];

  // ── Persistence ──
  const persistOpts = resolvePersistOptions(opts.persist);
  const persister = persistOpts
    ? createPersistSaver<TState>(persistOpts, onError)
    : null;

  // Merge persisted state with initial
  let initialState = (opts.initial ?? {}) as TState;
  if (persistOpts) {
    const restored = loadPersistedState<TState>(persistOpts);
    if (Object.keys(restored).length > 0) {
      initialState = { ...initialState, ...restored } as TState;
    }
  }

  // ── Channel ──
  const channel: Channel = createChannel(channelName, opts.transport);

  // ── Logger ──
  const { log } = createLogger(debug, tabId);

  // ── Send helper (adds protocol version) ──
  const send: SendFn = (message) => {
    log('→', message.type, message.payload);
    channel.postMessage(message);
  };

  // ── Core modules ──
  const stateManager = new StateManager<TState>({
    send,
    tabId,
    initial: initialState,
    merge: opts.merge,
    afterRemoteChange(key, value, meta) {
      notifyMiddleware(middlewares, key, value, meta);
      if (persister) persister.save(stateManager.getAll());
    },
  });

  const registry = new TabRegistry({
    send,
    tabId,
    tabCreatedAt,
    heartbeatInterval,
    tabTimeout: leaderTimeout,
  });

  let election: LeaderElection | null = null;
  if (leaderEnabled) {
    election = new LeaderElection({
      send,
      tabId,
      tabCreatedAt,
      heartbeatInterval,
      missedHeartbeatsLimit,
    });
  }

  const rpc = new RPCHandler({
    send,
    tabId,
    resolveLeaderId: () => election?.getLeaderId() ?? null,
    onError,
  });

  // ── Message routing ──
  const unsubChannel = channel.onMessage((message: TabMessage) => {
    log('←', message.type, `from=${message.senderId}`);

    if (message.senderId === tabId) return;

    // Protocol version check (forward compatible)
    if (message.version && message.version > PROTOCOL_VERSION) {
      log('⚠️', `Unknown protocol v${message.version}, ignoring`);
      return;
    }

    registry.handleMessage(message);

    switch (message.type) {
      case 'STATE_UPDATE':
      case 'STATE_SYNC_RESPONSE':
        stateManager.handleMessage(message);
        break;

      case 'STATE_SYNC_REQUEST':
        if (election?.isLeader() ?? true) {
          stateManager.respondToSync(message.senderId);
        }
        break;

      case 'LEADER_CLAIM':
      case 'LEADER_ACK':
      case 'LEADER_HEARTBEAT':
      case 'LEADER_RESIGN':
        election?.handleMessage(message);
        if (election) {
          registry.setLeader(election.getLeaderId());
        }
        break;

      case 'RPC_REQUEST':
      case 'RPC_RESPONSE':
        rpc.handleMessage(message);
        break;
    }
  });

  // ── Start ──
  registry.announce();
  stateManager.requestSync();
  election?.start();

  let ready = true;
  let destroyed = false;

  // ── Middleware-wrapped state operations ──

  function middlewareSet<K extends keyof TState>(key: K, value: TState[K]): void {
    if (middlewares.length === 0) {
      stateManager.set(key, value);
      if (persister) persister.save(stateManager.getAll());
      return;
    }

    const meta: ChangeMeta = { sourceTabId: tabId, isLocal: true, timestamp: Date.now() };
    const { value: finalValue, rejected } = runMiddleware(middlewares, {
      key,
      value,
      previousValue: stateManager.get(key),
      meta,
    });

    if (rejected) {
      log('🚫', `Middleware rejected set("${String(key)}")`);
      return;
    }

    stateManager.set(key, finalValue as TState[K]);
    notifyMiddleware(middlewares, key, finalValue, meta);
    if (persister) persister.save(stateManager.getAll());
  }

  function middlewarePatch(partial: Partial<TState>): void {
    if (middlewares.length === 0) {
      stateManager.patch(partial);
      if (persister) persister.save(stateManager.getAll());
      return;
    }

    const meta: ChangeMeta = { sourceTabId: tabId, isLocal: true, timestamp: Date.now() };
    const filtered: Partial<TState> = {};
    const appliedKeys: (keyof TState)[] = [];

    for (const [key, value] of Object.entries(partial)) {
      const k = key as keyof TState;
      const { value: finalValue, rejected } = runMiddleware(middlewares, {
        key: k,
        value,
        previousValue: stateManager.get(k),
        meta,
      });

      if (!rejected) {
        (filtered as Record<string, unknown>)[key] = finalValue;
        appliedKeys.push(k);
      }
    }

    if (Object.keys(filtered).length > 0) {
      stateManager.patch(filtered);
      for (const k of appliedKeys) {
        notifyMiddleware(middlewares, k, stateManager.get(k), meta);
      }
      if (persister) persister.save(stateManager.getAll());
    }
  }

  // ── Public instance ──

  const instance: TabSyncInstance<TState, TRPCMap> = {
    // State
    get: <K extends keyof TState>(key: K) => stateManager.get(key),
    getAll: () => stateManager.getAll(),
    set: middlewareSet,
    patch: middlewarePatch,

    // Subscriptions
    on: <K extends keyof TState>(
      key: K,
      callback: (value: TState[K], meta: ChangeMeta) => void,
    ) => stateManager.on(key, callback),

    once: <K extends keyof TState>(
      key: K,
      callback: (value: TState[K], meta: ChangeMeta) => void,
    ) => {
      const unsub = stateManager.on(key, ((value: unknown, meta: ChangeMeta) => {
        unsub();
        callback(value as TState[K], meta);
      }) as (value: TState[K], meta: ChangeMeta) => void);
      return unsub;
    },

    onChange: (
      callback: (
        state: Readonly<TState>,
        changedKeys: (keyof TState)[],
        meta: ChangeMeta,
      ) => void,
    ) => stateManager.onChange(callback),

    select: <TResult>(
      selector: (state: Readonly<TState>) => TResult,
      callback: (result: TResult, meta: ChangeMeta) => void,
      isEqual: (a: TResult, b: TResult) => boolean = Object.is,
    ) => {
      let prev = selector(stateManager.getAll());
      return stateManager.onChange((state, _keys, meta) => {
        const next = selector(state);
        if (!isEqual(prev, next)) {
          prev = next;
          callback(next, meta);
        }
      });
    },

    // Leader
    isLeader: () => election?.isLeader() ?? true,

    onLeader: (callback: () => void | (() => void)) => {
      if (!election) {
        const cleanup = callback();
        return () => {
          if (typeof cleanup === 'function') cleanup();
        };
      }
      return election.onLeader(callback);
    },

    getLeader: (): TabInfo | null => {
      const leaderId = election?.getLeaderId();
      if (!leaderId) return null;
      return registry.getTab(leaderId) ?? null;
    },

    waitForLeader: (): Promise<TabInfo> => {
      const leader = instance.getLeader();
      if (leader) return Promise.resolve(leader);

      return new Promise<TabInfo>((resolve) => {
        const unsubs: (() => void)[] = [];
        const check = () => {
          const l = instance.getLeader();
          if (l) {
            for (const u of unsubs) u();
            resolve(l);
          }
        };
        unsubs.push(registry.onTabChange(check));
        if (election) {
          unsubs.push(election.onLeader(() => { check(); return () => {}; }));
        }
      });
    },

    // Tabs
    id: tabId,
    getTabs: () => registry.getTabs(),
    getTabCount: () => registry.getTabCount(),
    onTabChange: (callback) => registry.onTabChange(callback),

    // RPC
    call: ((target: string | 'leader', method: string, args?: unknown, timeout?: number) =>
      rpc.call(target, method, args, timeout)) as TabSyncInstance<TState, TRPCMap>['call'],

    handle: ((method: string, handler: (args: unknown, callerTabId: string) => unknown) =>
      rpc.handle(method, handler)) as TabSyncInstance<TState, TRPCMap>['handle'],

    // Lifecycle
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      ready = false;

      stateManager.flush();
      persister?.destroy();
      destroyMiddleware(middlewares);
      election?.destroy();
      registry.destroy();
      rpc.destroy();
      stateManager.destroy();
      unsubChannel();
      channel.close();

      log('💀', 'Instance destroyed');
    },

    get ready() {
      return ready;
    },
  };

  log('🚀', 'Instance created', { channel: channelName, leader: leaderEnabled });

  return instance;
}
