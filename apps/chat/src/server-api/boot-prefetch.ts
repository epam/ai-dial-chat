import type { FetchAPI } from '@epam/ai-dial-chat-api-client';
import { ApiEndpoints } from './base';

/**
 * The GET requests `public/boot-prefetch.js` starts from the `index.html`
 * head, by the exact URL the generated client requests them with. That script
 * spells the same list out; `tests/boot-prefetch.spec.ts` keeps them equal.
 */
export const BOOT_PREFETCH_URLS = [
  ApiEndpoints.AUTH_ME,
  '/api/v1/client-config?appId=ai-dial-chat',
  '/api/v1/user-config',
] as const;

/** The `window` property `public/boot-prefetch.js` parks its responses on. */
export const BOOT_PREFETCH_GLOBAL = '__dialBootPrefetch';

/*
 * A response taken later than this after the head script ran could describe a
 * session or a config that has changed since, so it is dropped and the request
 * goes to the network.
 */
export const BOOT_PREFETCH_MAX_AGE_MS = 10_000;

interface BootPrefetchState {
  startedAt: number;
  responses: Record<string, Promise<Response> | undefined>;
}

const readState = (): BootPrefetchState | undefined => {
  const state = (window as unknown as Record<string, unknown>)[
    BOOT_PREFETCH_GLOBAL
  ];
  if (state == null || typeof state !== 'object') return undefined;
  return state as BootPrefetchState;
};

/** Returns the request URL as path plus query, the key the head script uses. */
const toRequestKey = (input: Parameters<FetchAPI>[0]): string | undefined => {
  let href: string;
  if (typeof input === 'string') {
    href = input;
  } else if (input instanceof URL) {
    href = input.href;
  } else {
    href = input.url;
  }
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
};

/**
 * Removes and returns the head script's response for `key`, or `undefined`
 * when there is none, it was already taken, or it is older than
 * `BOOT_PREFETCH_MAX_AGE_MS`.
 */
export const takeBootPrefetch = (
  key: string,
  now: number = performance.now(),
): Promise<Response> | undefined => {
  const state = readState();
  const response = state?.responses[key];
  if (state == null || response == null) return undefined;
  delete state.responses[key];
  if (now - state.startedAt > BOOT_PREFETCH_MAX_AGE_MS) return undefined;
  return response;
};

/**
 * Wraps `fetchImpl` so the first GET of a URL the head script prefetched
 * resolves to that response instead of a second request. Every other call,
 * and a prefetch that failed, goes to `fetchImpl`. The client's middleware
 * still sees the response, so CSRF priming and 401 handling are unchanged.
 */
export const createBootPrefetchFetch =
  (fetchImpl: FetchAPI = (...args) => fetch(...args)): FetchAPI =>
  async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const key = method === 'GET' ? toRequestKey(input) : undefined;
    const prefetched = key == null ? undefined : takeBootPrefetch(key);
    if (prefetched != null) {
      try {
        return await prefetched;
      } catch {
        /* The early request failed (offline, aborted): send it again. */
      }
    }
    return fetchImpl(input, init);
  };
