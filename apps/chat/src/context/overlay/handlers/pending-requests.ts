import type { OverlayMessageRequest } from '@epam/ai-dial-chat-overlay';
import type { MutableRefObject } from 'react';

const DEFAULT_PENDING_BRIDGE_REQUEST_TIMEOUT_MS = 10000;

/** A request held until its bridge registers or it expires. */
export interface PendingBridgeRequest {
  request: OverlayMessageRequest;
  timeoutId: number;
}

/** When a held request is dropped: its `expiresAt`, or a default timeout from now. */
export const getRequestExpiresAt = (request: OverlayMessageRequest): number =>
  typeof request.expiresAt === 'number'
    ? request.expiresAt
    : Date.now() + DEFAULT_PENDING_BRIDGE_REQUEST_TIMEOUT_MS;

/** True when the request carries an `expiresAt` that has already passed. */
export const isRequestExpired = (request: OverlayMessageRequest): boolean =>
  typeof request.expiresAt === 'number' && request.expiresAt <= Date.now();

/** Queues `request` on `requestsRef` until `getRequestExpiresAt` passes, then drops it. */
export const queuePendingRequest = (
  requestsRef: MutableRefObject<PendingBridgeRequest[]>,
  request: OverlayMessageRequest,
): void => {
  const expiresAt = getRequestExpiresAt(request);
  const delayMs = expiresAt - Date.now();
  if (delayMs <= 0) {
    return;
  }

  requestsRef.current = requestsRef.current.filter((pending) => {
    if (pending.request.requestId !== request.requestId) {
      return true;
    }
    window.clearTimeout(pending.timeoutId);
    return false;
  });

  const timeoutId = window.setTimeout(() => {
    requestsRef.current = requestsRef.current.filter(
      (pending) => pending.request.requestId !== request.requestId,
    );
  }, delayMs);

  requestsRef.current.push({ request, timeoutId });
};

/** Clears every queued request on `requestsRef` and their timeouts. */
export const clearPendingRequests = (
  requestsRef: MutableRefObject<PendingBridgeRequest[]>,
): void => {
  requestsRef.current.forEach(({ timeoutId }) => {
    window.clearTimeout(timeoutId);
  });
  requestsRef.current = [];
};
