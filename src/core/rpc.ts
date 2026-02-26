import type { TabMessage, RpcRequestPayload, RpcResponsePayload, SendFn } from '../types';
import { monotonic } from '../utils/timestamp';
import { generateTabId } from '../utils/id';
import { TabSyncError, ErrorCode } from '../utils/errors';

const DEFAULT_TIMEOUT = 5000;

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface RPCHandlerOptions {
  send: SendFn;
  tabId: string;
  resolveLeaderId?: () => string | null;
  onError?: (error: Error) => void;
}

export class RPCHandler {
  private readonly send: SendFn;
  private readonly tabId: string;
  private readonly resolveLeaderId: () => string | null;
  private readonly onError: (error: Error) => void;
  private readonly handlers = new Map<
    string,
    (args: unknown, callerTabId: string) => unknown
  >();
  private readonly pending = new Map<string, PendingCall>();

  constructor(options: RPCHandlerOptions) {
    this.send = options.send;
    this.tabId = options.tabId;
    this.resolveLeaderId = options.resolveLeaderId ?? (() => null);
    this.onError = options.onError ?? (() => {});
  }

  call<TResult>(
    targetTabId: string | 'leader',
    method: string,
    args?: unknown,
    timeout = DEFAULT_TIMEOUT,
  ): Promise<TResult> {
    const resolvedTarget =
      targetTabId === 'leader' ? this.resolveLeaderId() : targetTabId;

    if (!resolvedTarget) {
      return Promise.reject(TabSyncError.noLeader());
    }

    const callId = generateTabId();

    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(callId);
        reject(TabSyncError.timeout(method, timeout));
      }, timeout);

      this.pending.set(callId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      this.send({
        type: 'RPC_REQUEST',
        senderId: this.tabId,
        targetId: resolvedTarget,
        timestamp: monotonic(),
        payload: { callId, method, args } satisfies RpcRequestPayload,
      } as TabMessage);
    });
  }

  handle<TArgs = unknown, TResult = unknown>(
    method: string,
    handler: (args: TArgs, callerTabId: string) => TResult | Promise<TResult>,
  ): () => void {
    this.handlers.set(
      method,
      handler as (args: unknown, callerTabId: string) => unknown,
    );
    return () => {
      this.handlers.delete(method);
    };
  }

  handleMessage(message: TabMessage): void {
    switch (message.type) {
      case 'RPC_REQUEST':
        if (!message.targetId || message.targetId === this.tabId) {
          this.handleRequest(message);
        }
        break;
      case 'RPC_RESPONSE':
        if (!message.targetId || message.targetId === this.tabId) {
          this.handleResponse(message);
        }
        break;
    }
  }

  destroy(): void {
    const error = TabSyncError.destroyed();
    for (const [, call] of this.pending) {
      clearTimeout(call.timer);
      call.reject(error);
    }
    this.pending.clear();
    this.handlers.clear();
  }

  // ── Private ──

  private async handleRequest(message: TabMessage): Promise<void> {
    const { callId, method, args } = message.payload as RpcRequestPayload;
    const handler = this.handlers.get(method);

    if (!handler) {
      const err = TabSyncError.noHandler(method);
      this.onError(err);
      this.sendResponse(message.senderId, callId, undefined, err.message);
      return;
    }

    try {
      const result = await handler(args, message.senderId);
      this.sendResponse(message.senderId, callId, result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.onError(
        new TabSyncError(errorMsg, ErrorCode.RPC_HANDLER_ERROR, err),
      );
      this.sendResponse(message.senderId, callId, undefined, errorMsg);
    }
  }

  private handleResponse(message: TabMessage): void {
    const { callId, result, error } = message.payload as RpcResponsePayload;
    const call = this.pending.get(callId);
    if (!call) return;

    clearTimeout(call.timer);
    this.pending.delete(callId);

    if (error) {
      call.reject(
        new TabSyncError(error, ErrorCode.RPC_HANDLER_ERROR),
      );
    } else {
      call.resolve(result);
    }
  }

  private sendResponse(
    targetId: string,
    callId: string,
    result?: unknown,
    error?: string,
  ): void {
    this.send({
      type: 'RPC_RESPONSE',
      senderId: this.tabId,
      targetId,
      timestamp: monotonic(),
      payload: { callId, result, error } satisfies RpcResponsePayload,
    } as TabMessage);
  }
}
