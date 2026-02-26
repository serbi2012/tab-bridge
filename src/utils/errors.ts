export const ErrorCode = {
  CHANNEL_CLOSED: 'CHANNEL_CLOSED',
  CHANNEL_SEND_FAILED: 'CHANNEL_SEND_FAILED',
  RPC_TIMEOUT: 'RPC_TIMEOUT',
  RPC_NO_HANDLER: 'RPC_NO_HANDLER',
  RPC_NO_LEADER: 'RPC_NO_LEADER',
  RPC_HANDLER_ERROR: 'RPC_HANDLER_ERROR',
  RPC_DESTROYED: 'RPC_DESTROYED',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  MIDDLEWARE_REJECTED: 'MIDDLEWARE_REJECTED',
  ALREADY_DESTROYED: 'ALREADY_DESTROYED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class TabSyncError extends Error {
  override readonly name = 'TabSyncError';
  readonly cause?: unknown;

  constructor(
    message: string,
    public readonly code: ErrorCode,
    cause?: unknown,
  ) {
    super(message);
    this.cause = cause;
  }

  static timeout(method: string, ms: number): TabSyncError {
    return new TabSyncError(
      `RPC "${method}" timed out after ${ms}ms`,
      ErrorCode.RPC_TIMEOUT,
    );
  }

  static noLeader(): TabSyncError {
    return new TabSyncError('No leader available', ErrorCode.RPC_NO_LEADER);
  }

  static noHandler(method: string): TabSyncError {
    return new TabSyncError(
      `No handler registered for "${method}"`,
      ErrorCode.RPC_NO_HANDLER,
    );
  }

  static destroyed(): TabSyncError {
    return new TabSyncError('Instance has been destroyed', ErrorCode.ALREADY_DESTROYED);
  }
}
