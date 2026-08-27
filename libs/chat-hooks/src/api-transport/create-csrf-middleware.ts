import type { Middleware } from '@epam/ai-dial-chat-api-client';

/** Host capabilities {@link createCsrfMiddleware} needs to attach and capture a CSRF token. */
export interface CreateCsrfMiddlewareDeps {
  /** Returns the currently held CSRF token, or `null` when none is set. */
  getCsrfToken: () => string | null;
  /** Stores a CSRF token captured from a response header, or `null` to clear it. */
  setCsrfToken: (token: string | null) => void;
}

/**
 * Builds a generated-client `Middleware` that attaches `X-CSRF-Token` on every
 * non-GET request when a token is set, and captures a rotated token from the
 * `x-csrf-token` response header.
 */
export const createCsrfMiddleware = (
  deps: CreateCsrfMiddlewareDeps,
): Middleware => ({
  pre: async (context) => {
    const token = deps.getCsrfToken();
    if (context.init.method === 'GET' || token === null) {
      return context;
    }
    const headers = new Headers(context.init.headers);
    headers.set('X-CSRF-Token', token);
    return {
      ...context,
      init: {
        ...context.init,
        headers,
      },
    };
  },
  post: async (context) => {
    const rotated = context.response.headers.get('x-csrf-token');
    if (rotated) deps.setCsrfToken(rotated);
    return context.response;
  },
});
