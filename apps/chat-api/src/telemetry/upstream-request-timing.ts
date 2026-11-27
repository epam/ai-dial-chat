import { AsyncLocalStorage } from 'node:async_hooks';
import { channel } from 'node:diagnostics_channel';
import {
  RequestTimingState,
  RequestTimingUpstream,
  requestTimingStorage,
} from './request-timing-state';

interface MarkedUpstream {
  timing: RequestTimingState;
  upstream: RequestTimingUpstream;
}

const upstreamRequestStorage = new AsyncLocalStorage<MarkedUpstream>();
let requestEndings = new WeakMap<object, () => void>();
let subscribed = false;

const getRequest = (message: unknown): object | undefined => {
  if (typeof message !== 'object' || message === null) return undefined;
  const request = (message as { request?: unknown }).request;
  return typeof request === 'object' && request !== null ? request : undefined;
};

const onRequestCreated = (message: unknown): void => {
  const marked = upstreamRequestStorage.getStore();
  const request = getRequest(message);
  if (!marked || !request || requestEndings.has(request)) return;
  requestEndings.set(request, marked.timing.startUpstreamCall(marked.upstream));
};

const onRequestEnded = (message: unknown): void => {
  const request = getRequest(message);
  if (!request) return;
  requestEndings.get(request)?.();
  requestEndings.delete(request);
};

/*
 * Undici emits trailers only after the response body completes, and error for
 * failed/cancelled transfers (a cancelled error body included). Observing
 * these channels preserves native fetch and stream behaviour, unlike consuming
 * or replacing Response.body. Only the marked upstream transports (DIAL Core
 * and DIAL Analytics) are timed; themes, OIDC and other native-fetch traffic
 * stay unmarked and fall into the remainder.
 */
export const initializeUpstreamRequestTiming = (): void => {
  if (subscribed) return;
  subscribed = true;
  channel('undici:request:create').subscribe(onRequestCreated);
  channel('undici:request:trailers').subscribe(onRequestEnded);
  channel('undici:request:error').subscribe(onRequestEnded);
};

export const stopUpstreamRequestTiming = (): void => {
  if (!subscribed) return;
  channel('undici:request:create').unsubscribe(onRequestCreated);
  channel('undici:request:trailers').unsubscribe(onRequestEnded);
  channel('undici:request:error').unsubscribe(onRequestEnded);
  subscribed = false;
  requestEndings = new WeakMap();
};

/*
 * AsyncLocalStorage.run nests, so the innermost marker wins: a call made under
 * an Analytics marker nested inside a Core marker counts only as Analytics.
 */
const withUpstreamRequestTiming = <T>(
  upstream: RequestTimingUpstream,
  callback: () => T,
): T => {
  const timing = requestTimingStorage.getStore();
  return subscribed && timing
    ? upstreamRequestStorage.run({ timing, upstream }, callback)
    : callback();
};

/** Mark the shared DIAL Core transport without changing its response or body. */
export const withCoreRequestTiming = <T>(callback: () => T): T =>
  withUpstreamRequestTiming(RequestTimingUpstream.Core, callback);

/** Mark the DIAL Analytics transport without changing its response or body. */
export const withAnalyticsRequestTiming = <T>(callback: () => T): T =>
  withUpstreamRequestTiming(RequestTimingUpstream.Analytics, callback);
