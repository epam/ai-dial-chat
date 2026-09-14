import type { Middleware } from '@epam/ai-dial-chat-api-client';

type MiddlewarePostContext = Parameters<NonNullable<Middleware['post']>>[0];

/** Outcome of a CSRF-token refresh attempt, reported back to {@link createUnauthorizedMiddleware}. */
export type CsrfRefreshOutcome =
  { status: 'ok'; token: string } | { status: 'unauthorized' | 'failed' };

/** An error thrown to indicate the caller is unauthenticated. */
export interface UnauthorizedErrorLike extends Error {
  readonly status: 401;
  readonly url: string;
}

/** Host capabilities {@link createUnauthorizedMiddleware} needs to handle 401s and invalid-CSRF retries. */
export interface CreateUnauthorizedMiddlewareDeps {
  /** Notifies the host that a request was unauthorized (also expected to clear any held CSRF token). */
  notifyUnauthorized: (url: string) => void;
  /** Attempts to refresh the CSRF token, de-duplicating concurrent calls. */
  refreshCsrfToken: () => Promise<CsrfRefreshOutcome>;
  /** Classifies a response body as an invalid-CSRF error. */
  isInvalidCsrfErrorBody: (body: string) => boolean;
  /** Returns the currently held CSRF token, or `null` when none is set. */
  getCsrfToken: () => string | null;
  /**
   * Stores a CSRF token captured from a response header. Needed here (in
   * addition to the CSRF middleware's own `post` hook) because the
   * invalid-CSRF retry issues its own `fetch` outside the generated-client
   * middleware pipeline, so its response header is never seen by that hook.
   */
  setCsrfToken: (token: string | null) => void;
  /** Constructs the error thrown to signal an unauthorized request. */
  createUnauthorizedError: (url: string) => UnauthorizedErrorLike;
}

const readResponseBody = async (response: Response): Promise<string> => {
  try {
    return await response.clone().text();
  } catch {
    return '';
  }
};

/*
 * The runtime threads the exact `init` object built in the CSRF middleware's
 * `pre` hook through to `post`, so the token actually sent can be read back
 * from it.
 */
const getDispatchCsrfToken = (init: RequestInit): string | null =>
  new Headers(init.headers).get('X-CSRF-Token');

const fetchWithCsrfToken = (
  context: MiddlewarePostContext,
  token: string,
): Promise<Response> => {
  const headers = new Headers(context.init.headers);
  if (context.init.method !== 'GET') {
    headers.set('X-CSRF-Token', token);
  }
  return fetch(context.url, {
    ...context.init,
    headers,
  });
};

/**
 * Builds a generated-client `Middleware` that throws on 401, and on a
 * classified invalid-CSRF 403 refreshes the token and retries the original
 * request exactly once.
 */
export const createUnauthorizedMiddleware = (
  deps: CreateUnauthorizedMiddlewareDeps,
): Middleware => {
  const retryWithFreshCsrf = async (
    context: MiddlewarePostContext,
  ): Promise<Response> => {
    const dispatchToken = getDispatchCsrfToken(context.init);
    const currentToken = deps.getCsrfToken();

    if (currentToken !== null && currentToken !== dispatchToken) {
      // A concurrent request already refreshed the token; reuse it.
      return fetchWithCsrfToken(context, currentToken);
    }

    const refreshed = await deps.refreshCsrfToken();
    if (refreshed.status === 'unauthorized') {
      deps.notifyUnauthorized(context.url);
      throw deps.createUnauthorizedError(context.url);
    }
    if (refreshed.status !== 'ok') {
      throw new Error(`CSRF refresh failed for ${context.url}`);
    }

    return fetchWithCsrfToken(context, refreshed.token);
  };

  const handleRetryResponse = async (
    context: MiddlewarePostContext,
    response: Response,
  ): Promise<Response> => {
    const rotated = response.headers.get('x-csrf-token');
    if (rotated) {
      deps.setCsrfToken(rotated);
    }

    if (response.status === 401) {
      deps.notifyUnauthorized(context.url);
      throw deps.createUnauthorizedError(context.url);
    }

    if (!response.ok) {
      const errorBody = await readResponseBody(response);
      if (response.status === 403 && deps.isInvalidCsrfErrorBody(errorBody)) {
        deps.notifyUnauthorized(context.url);
        throw deps.createUnauthorizedError(context.url);
      }
      throw new Error(
        `Request failed with status ${response.status} for ${context.init.method ?? 'GET'} ${context.url}: ${errorBody}`,
      );
    }

    return response;
  };

  return {
    post: async (context) => {
      if (context.response.status === 401) {
        deps.notifyUnauthorized(context.url);
        throw deps.createUnauthorizedError(context.url);
      }
      if (context.response.status === 403) {
        const body = await readResponseBody(context.response);
        if (deps.isInvalidCsrfErrorBody(body)) {
          const retryResponse = await retryWithFreshCsrf(context);
          return handleRetryResponse(context, retryResponse);
        }
      }
      return context.response;
    },
  };
};
