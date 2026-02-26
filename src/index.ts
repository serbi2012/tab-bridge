// ── Main API ──
export { createTabSync } from './core/tab-sync';

// ── Types ──
export type {
  MessageType,
  MessagePayloadMap,
  TabMessage,
  MessageOf,
  SendFn,
  TabInfo,
  ChangeMeta,
  LeaderOptions,
  TabSyncOptions,
  TabSyncInstance,
  StateUpdatePayload,
  StateSyncResponsePayload,
  LeaderClaimPayload,
  TabAnnouncePayload,
  RpcRequestPayload,
  RpcResponsePayload,
  // Middleware
  Middleware,
  MiddlewareContext,
  MiddlewareResult,
  // Persistence
  PersistOptions,
  // Typed RPC
  RPCMap,
  RPCArgs,
  RPCResult,
} from './types';

export { PROTOCOL_VERSION } from './types';

// ── Channels ──
export type { Channel } from './channels/channel';
export { createChannel } from './channels/channel';
export { BroadcastChannelTransport } from './channels/broadcast';
export { StorageChannel } from './channels/storage';

// ── Core (advanced usage) ──
export { StateManager, type StateManagerOptions } from './core/state-manager';
export { TabRegistry, type TabRegistryOptions } from './core/tab-registry';
export { LeaderElection, type LeaderElectionOptions } from './core/leader-election';
export { RPCHandler, type RPCHandlerOptions } from './core/rpc';
export { runMiddleware, notifyMiddleware, destroyMiddleware } from './core/middleware';

// ── Utils ──
export { generateTabId } from './utils/id';
export { monotonic } from './utils/timestamp';
export { createBatcher, type Batcher } from './utils/batch';
export { createMessage } from './utils/message';
export { Emitter } from './utils/emitter';
export { TabSyncError, ErrorCode } from './utils/errors';
export { isBrowser, hasDocument, hasLocalStorage, hasBroadcastChannel, hasCrypto } from './utils/env';
