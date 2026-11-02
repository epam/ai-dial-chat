import { AsyncLocalStorage } from 'node:async_hooks';
import { channel } from 'node:diagnostics_channel';
import {
  RequestTimingState,
  requestTimingStorage,
} from './request-timing-state';

const coreRequestStorage = new AsyncLocalStorage<RequestTimingState>();
let requestEndings = new WeakMap<object, () => void>();
let subscribed = false;

const getRequest = (message: unknown): object | undefined => {
  if (typeof message !== 'object' || message === null) return undefined;
  const request = (message as { request?: unknown }).request;
  return typeof request === 'object' && request !== null ? request : undefined;
};

const onRequestCreated = (message: unknown): void => {
  const timing = coreRequestStorage.getStore();
  const request = getRequest(message);
  if (!timing || !request || requestEndings.has(request)) return;
  requestEndings.set(request, timing.startCoreCall());
};

const onRequestEnded = (message: unknown): void => {
  const request = getRequest(message);
  if (!request) return;
  requestEndings.get(request)?.();
  requestEndings.delete(request);
};

/*
 * Undici emits trailers only after the response body completes, and error for
 * failed/cancelled transfers. Observing these channels preserves native fetch
 * and stream behaviour, unlike consuming or replacing Response.body. A shared
 * Core-fetch context excludes themes, OIDC and other native-fetch traffic.
 */
export const initializeCoreRequestTiming = (): void => {
  if (subscribed) return;
  subscribed = true;
  channel('undici:request:create').subscribe(onRequestCreated);
  channel('undici:request:trailers').subscribe(onRequestEnded);
  channel('undici:request:error').subscribe(onRequestEnded);
};

export const stopCoreRequestTiming = (): void => {
  if (!subscribed) return;
  channel('undici:request:create').unsubscribe(onRequestCreated);
  channel('undici:request:trailers').unsubscribe(onRequestEnded);
  channel('undici:request:error').unsubscribe(onRequestEnded);
  subscribed = false;
  requestEndings = new WeakMap();
};

/** Mark the shared DIAL transport without changing its response or body. */
export const withCoreRequestTiming = <T>(callback: () => T): T => {
  const timing = requestTimingStorage.getStore();
  return subscribed && timing
    ? coreRequestStorage.run(timing, callback)
    : callback();
};
