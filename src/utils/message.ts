import {
  PROTOCOL_VERSION,
  type MessageType,
  type MessagePayloadMap,
  type MessageOf,
} from '../types';
import { monotonic } from './timestamp';

/**
 * Type-safe message factory. Guarantees every message has a correct
 * structure, protocol version, and monotonically increasing timestamp.
 *
 * ```ts
 * const msg = createMessage('STATE_UPDATE', tabId, { entries: { ... } });
 * //    ^? MessageOf<'STATE_UPDATE'>  — payload is StateUpdatePayload
 * ```
 */
export function createMessage<T extends MessageType>(
  type: T,
  senderId: string,
  payload: MessagePayloadMap[T],
  targetId?: string,
): MessageOf<T> {
  return {
    type,
    senderId,
    targetId,
    timestamp: monotonic(),
    version: PROTOCOL_VERSION,
    payload,
  } as MessageOf<T>;
}
