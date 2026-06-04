import { ConversationsApi, ModelsApi } from '@epam/chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiConfiguration } from '../api-client';
import { UnauthorizedError, onUnauthorized, setCsrfToken } from '../base';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeResponse = (status: number): Response =>
  new Response(JSON.stringify({ data: [] }), {
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
    // These tests only inspect request headers; response shape is irrelevant.
  }
};

afterEach(() => {
  setCsrfToken(null);
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// CSRF middleware
// ---------------------------------------------------------------------------

describe('csrfMiddleware', () => {
  it('injects X-CSRF-Token header on POST when token is set', async () => {
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

  it('does not inject X-CSRF-Token on GET', async () => {
    setCsrfToken('test-token');
    const fetchSpy = setupFetch(200);
    const api = new ModelsApi(createApiConfiguration());

    await ignoreRejection(api.listModels());

    expect(getLastRequestHeaders(fetchSpy).get('X-CSRF-Token')).toBeNull();
  });

  it('does not inject X-CSRF-Token when token is null', async () => {
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

    expect(getLastRequestHeaders(fetchSpy).get('X-CSRF-Token')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unauthorized middleware
// ---------------------------------------------------------------------------

describe('unauthorizedMiddleware', () => {
  it('throws UnauthorizedError and calls listener on 401', async () => {
    setupFetch(401);
    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    const api = new ModelsApi(createApiConfiguration());
    await expect(api.listModels()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(listener).toHaveBeenCalledOnce();

    cleanup();
  });

  it('does not call unauthorized listener on non-401 error', async () => {
    setupFetch(500);
    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    const api = new ModelsApi(createApiConfiguration());
    await expect(api.listModels()).rejects.not.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(listener).not.toHaveBeenCalled();

    cleanup();
  });
});
