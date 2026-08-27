import { ConversationsApi, ModelsApi } from '@epam/ai-dial-chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiConfiguration } from '../api-client';
import {
  UnauthorizedError,
  getCsrfToken,
  onUnauthorized,
  setCsrfToken,
} from '../base';

/*
 * `createCsrfMiddleware`/`createUnauthorizedMiddleware`'s own behavior
 * (header injection, rotation capture, invalid-CSRF refresh-and-retry, 401
 * handling) is covered exhaustively by their own spec files in
 * `@epam/ai-dial-chat-hooks` (`create-csrf-middleware.spec.ts`,
 * `create-unauthorized-middleware.spec.ts`). This spec only smoke-tests that
 * `createApiConfiguration` wires `apps/chat`'s own `base.ts` CSRF/unauthorized
 * state into those factories correctly end-to-end.
 */

const makeResponse = (status: number, body: unknown = { data: [] }): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const setupFetch = (status: number) => {
  const fetchSpy = vi
    .fn<typeof fetch>()
    .mockResolvedValue(makeResponse(status));
  global.fetch = fetchSpy;
  return fetchSpy;
};

const getLastRequestHeaders = (fetchSpy: ReturnType<typeof setupFetch>) =>
  new Headers(fetchSpy.mock.calls[0]?.[1]?.headers);

const ignoreRejection = async (promise: Promise<unknown>): Promise<void> => {
  try {
    await promise;
  } catch {
    // These tests only inspect request headers/side effects.
  }
};

afterEach(() => {
  setCsrfToken(null);
  vi.restoreAllMocks();
});

describe('createApiConfiguration', () => {
  it('wires the CSRF middleware to apps/chat CSRF state', async () => {
    setCsrfToken('test-token');
    const fetchSpy = setupFetch(200);
    const api = new ConversationsApi(createApiConfiguration());

    await ignoreRejection(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    );

    expect(getLastRequestHeaders(fetchSpy).get('X-CSRF-Token')).toBe(
      'test-token',
    );
  });

  it('wires the unauthorized middleware to apps/chat UnauthorizedError and notification state', async () => {
    setCsrfToken('stale-token');
    setupFetch(401);
    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    const api = new ModelsApi(createApiConfiguration());
    await expect(api.listModels()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(listener).toHaveBeenCalledOnce();
    expect(getCsrfToken()).toBeNull();

    cleanup();
  });
});
