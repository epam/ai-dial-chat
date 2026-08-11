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
 * ---------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------
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
    // These tests only inspect request headers; response shape is irrelevant.
  }
};

afterEach(() => {
  setCsrfToken(null);
  vi.restoreAllMocks();
});

/*
 * ---------------------------------------------------------------------------
 * CSRF middleware
 * ---------------------------------------------------------------------------
 */

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

  it('captures rotated X-CSRF-Token from response header', async () => {
    setCsrfToken('old-token');
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': 'rotated-token',
        },
      }),
    );
    const api = new ConversationsApi(createApiConfiguration());

    await ignoreRejection(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    );

    expect(getCsrfToken()).toBe('rotated-token');
  });
});

/*
 * ---------------------------------------------------------------------------
 * Unauthorized middleware
 * ---------------------------------------------------------------------------
 */

describe('unauthorizedMiddleware', () => {
  it('throws UnauthorizedError and calls listener on 401', async () => {
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

  it('refreshes CSRF token and retries once on invalid CSRF responses', async () => {
    setCsrfToken('stale-token');
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeResponse(403, {
          code: 'CSRF_INVALID',
          message: 'Invalid CSRF token',
          error: 'Forbidden',
          statusCode: 403,
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'x-csrf-token': 'fresh-token' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-csrf-token': 'retry-token',
          },
        }),
      );
    global.fetch = fetchSpy;
    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    const api = new ConversationsApi(createApiConfiguration());
    await ignoreRejection(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    );

    expect(listener).not.toHaveBeenCalled();
    expect(getCsrfToken()).toBe('retry-token');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(getLastRequestHeaders(fetchSpy).get('X-CSRF-Token')).toBe(
      'stale-token',
    );
    expect(fetchSpy.mock.calls[1]?.[0]).toBe('/api/v1/auth/me');
    expect(
      new Headers(fetchSpy.mock.calls[2]?.[1]?.headers).get('X-CSRF-Token'),
    ).toBe('fresh-token');

    cleanup();
  });

  it('throws UnauthorizedError when retried request gets a 401 response', async () => {
    setCsrfToken('stale-token');
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeResponse(403, {
          code: 'CSRF_INVALID',
          message: 'Invalid CSRF token',
          error: 'Forbidden',
          statusCode: 403,
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'x-csrf-token': 'fresh-token' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    global.fetch = fetchSpy;
    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    const api = new ConversationsApi(createApiConfiguration());
    await expect(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(listener).toHaveBeenCalledWith('/api/v1/conversations');
    expect(getCsrfToken()).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    cleanup();
  });

  it('throws UnauthorizedError when retried request gets another invalid CSRF response', async () => {
    setCsrfToken('stale-token');
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeResponse(403, {
          code: 'CSRF_INVALID',
          message: 'Invalid CSRF token',
          error: 'Forbidden',
          statusCode: 403,
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'x-csrf-token': 'fresh-token' },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(403, {
          code: 'CSRF_INVALID',
          message: 'Invalid CSRF token',
          error: 'Forbidden',
          statusCode: 403,
        }),
      );
    global.fetch = fetchSpy;
    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    const api = new ConversationsApi(createApiConfiguration());
    await expect(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(listener).toHaveBeenCalledWith('/api/v1/conversations');
    expect(getCsrfToken()).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    cleanup();
  });

  it('throws a descriptive error when retried request gets a non-CSRF error', async () => {
    setCsrfToken('stale-token');
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeResponse(403, {
          code: 'CSRF_INVALID',
          message: 'Invalid CSRF token',
          error: 'Forbidden',
          statusCode: 403,
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { 'x-csrf-token': 'fresh-token' },
        }),
      )
      .mockResolvedValueOnce(makeResponse(500, { message: 'server error' }));
    global.fetch = fetchSpy;
    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    const api = new ConversationsApi(createApiConfiguration());
    await expect(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    ).rejects.toThrow('Request failed with status 500');

    expect(listener).not.toHaveBeenCalled();
    expect(getCsrfToken()).toBe('fresh-token');
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    cleanup();
  });

  it('throws UnauthorizedError when CSRF refresh gets a 401 response', async () => {
    setCsrfToken('stale-token');
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeResponse(403, {
          code: 'CSRF_INVALID',
          message: 'Invalid CSRF token',
          error: 'Forbidden',
          statusCode: 403,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    global.fetch = fetchSpy;
    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    const api = new ConversationsApi(createApiConfiguration());
    await expect(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(listener).toHaveBeenCalledOnce();
    expect(getCsrfToken()).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it('throws a plain error without logging out when CSRF refresh does not return a token', async () => {
    setCsrfToken('stale-token');
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        makeResponse(403, {
          code: 'CSRF_INVALID',
          message: 'Invalid CSRF token',
          error: 'Forbidden',
          statusCode: 403,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    global.fetch = fetchSpy;
    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    const api = new ConversationsApi(createApiConfiguration());
    await expect(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    ).rejects.not.toBeInstanceOf(UnauthorizedError);

    expect(listener).not.toHaveBeenCalled();
    expect(getCsrfToken()).toBe('stale-token');
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it('retries with an already-refreshed token when a concurrent request updated it', async () => {
    setCsrfToken('stale-token');
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => {
        setCsrfToken('fresh-token');
        return makeResponse(403, {
          code: 'CSRF_INVALID',
          message: 'Invalid CSRF token',
          error: 'Forbidden',
          statusCode: 403,
        });
      })
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    global.fetch = fetchSpy;
    const listener = vi.fn();
    const cleanup = onUnauthorized(listener);

    const api = new ConversationsApi(createApiConfiguration());
    await ignoreRejection(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    );

    expect(listener).not.toHaveBeenCalled();
    expect(getCsrfToken()).toBe('fresh-token');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(
      new Headers(fetchSpy.mock.calls[1]?.[1]?.headers).get('X-CSRF-Token'),
    ).toBe('fresh-token');

    cleanup();
  });
});
