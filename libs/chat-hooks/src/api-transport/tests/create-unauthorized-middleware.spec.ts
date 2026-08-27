import {
  Configuration,
  ConversationsApi,
  ModelsApi,
} from '@epam/ai-dial-chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCsrfMiddleware } from '../create-csrf-middleware';
import {
  createUnauthorizedMiddleware,
  type CsrfRefreshOutcome,
  type UnauthorizedErrorLike,
} from '../create-unauthorized-middleware';

class TestUnauthorizedError extends Error implements UnauthorizedErrorLike {
  readonly status = 401 as const;
  constructor(public readonly url: string) {
    super(`Unauthorized: ${url}`);
    this.name = 'TestUnauthorizedError';
  }
}

let csrfToken: string | null = null;
const getCsrfToken = () => csrfToken;
const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};

const isInvalidCsrfErrorBody = (body: string): boolean => {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return parsed.code === 'CSRF_INVALID';
  } catch {
    return false;
  }
};

const makeConfig = (
  refreshCsrfToken: () => Promise<CsrfRefreshOutcome>,
  notifyUnauthorized: (url: string) => void,
) =>
  new Configuration({
    basePath: '',
    credentials: 'include',
    middleware: [
      createCsrfMiddleware({ getCsrfToken, setCsrfToken }),
      createUnauthorizedMiddleware({
        notifyUnauthorized,
        refreshCsrfToken,
        refreshUnauthorizedUrl: '/api/v1/auth/me',
        isInvalidCsrfErrorBody,
        getCsrfToken,
        setCsrfToken,
        createUnauthorizedError: (url) => new TestUnauthorizedError(url),
      }),
    ],
  });

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

const ignoreRejection = async (promise: Promise<unknown>): Promise<void> => {
  try {
    await promise;
  } catch {
    // These tests only inspect request headers/side effects.
  }
};

const failingRefresh = (): Promise<CsrfRefreshOutcome> => {
  throw new Error('refreshCsrfToken should not be called in this test');
};

afterEach(() => {
  setCsrfToken(null);
  vi.restoreAllMocks();
});

describe('createUnauthorizedMiddleware', () => {
  it('throws UnauthorizedError and notifies on 401', async () => {
    setCsrfToken('stale-token');
    setupFetch(401);
    const notifyUnauthorized = vi.fn();

    const api = new ModelsApi(makeConfig(failingRefresh, notifyUnauthorized));
    await expect(api.listModels()).rejects.toBeInstanceOf(
      TestUnauthorizedError,
    );
    expect(notifyUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not notify on non-401 error', async () => {
    setupFetch(500);
    const notifyUnauthorized = vi.fn();

    const api = new ModelsApi(makeConfig(failingRefresh, notifyUnauthorized));
    await expect(api.listModels()).rejects.not.toBeInstanceOf(
      TestUnauthorizedError,
    );
    expect(notifyUnauthorized).not.toHaveBeenCalled();
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
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-csrf-token': 'retry-token',
          },
        }),
      );
    global.fetch = fetchSpy;
    const notifyUnauthorized = vi.fn();
    const refreshCsrfToken = vi.fn(
      async (): Promise<CsrfRefreshOutcome> => ({
        status: 'ok',
        token: 'fresh-token',
      }),
    );

    const api = new ConversationsApi(
      makeConfig(refreshCsrfToken, notifyUnauthorized),
    );
    await ignoreRejection(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    );

    expect(notifyUnauthorized).not.toHaveBeenCalled();
    expect(refreshCsrfToken).toHaveBeenCalledOnce();
    expect(getCsrfToken()).toBe('retry-token');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(
      new Headers(fetchSpy.mock.calls[1]?.[1]?.headers).get('X-CSRF-Token'),
    ).toBe('fresh-token');
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
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    global.fetch = fetchSpy;
    const notifyUnauthorized = vi.fn();
    const refreshCsrfToken = vi.fn(
      async (): Promise<CsrfRefreshOutcome> => ({
        status: 'ok',
        token: 'fresh-token',
      }),
    );

    const api = new ConversationsApi(
      makeConfig(refreshCsrfToken, notifyUnauthorized),
    );
    await expect(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    ).rejects.toBeInstanceOf(TestUnauthorizedError);

    expect(notifyUnauthorized).toHaveBeenCalledWith('/api/v1/conversations');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
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
        makeResponse(403, {
          code: 'CSRF_INVALID',
          message: 'Invalid CSRF token',
          error: 'Forbidden',
          statusCode: 403,
        }),
      );
    global.fetch = fetchSpy;
    const notifyUnauthorized = vi.fn();
    const refreshCsrfToken = vi.fn(
      async (): Promise<CsrfRefreshOutcome> => ({
        status: 'ok',
        token: 'fresh-token',
      }),
    );

    const api = new ConversationsApi(
      makeConfig(refreshCsrfToken, notifyUnauthorized),
    );
    await expect(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    ).rejects.toBeInstanceOf(TestUnauthorizedError);

    expect(notifyUnauthorized).toHaveBeenCalledWith('/api/v1/conversations');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
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
      .mockResolvedValueOnce(makeResponse(500, { message: 'server error' }));
    global.fetch = fetchSpy;
    const notifyUnauthorized = vi.fn();
    const refreshCsrfToken = vi.fn(
      async (): Promise<CsrfRefreshOutcome> => ({
        status: 'ok',
        token: 'fresh-token',
      }),
    );

    const api = new ConversationsApi(
      makeConfig(refreshCsrfToken, notifyUnauthorized),
    );
    await expect(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    ).rejects.toThrow('Request failed with status 500');

    expect(notifyUnauthorized).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws UnauthorizedError when CSRF refresh is unauthorized', async () => {
    setCsrfToken('stale-token');
    setupFetch(403);
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      makeResponse(403, {
        code: 'CSRF_INVALID',
        message: 'Invalid CSRF token',
        error: 'Forbidden',
        statusCode: 403,
      }),
    );
    const notifyUnauthorized = vi.fn();
    const refreshCsrfToken = vi.fn(
      async (): Promise<CsrfRefreshOutcome> => ({ status: 'unauthorized' }),
    );

    const api = new ConversationsApi(
      makeConfig(refreshCsrfToken, notifyUnauthorized),
    );
    const request = api.createConversation({
      createConversationDto: {
        firstMessage: 'hi',
        deploymentId: 'test-deployment',
      },
    });

    await expect(request).rejects.toBeInstanceOf(TestUnauthorizedError);
    await expect(request).rejects.toMatchObject({
      status: 401,
      url: '/api/v1/auth/me',
    });

    expect(notifyUnauthorized).toHaveBeenCalledWith('/api/v1/auth/me');
  });

  it('throws a plain error without notifying when CSRF refresh fails without a token', async () => {
    setCsrfToken('stale-token');
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      makeResponse(403, {
        code: 'CSRF_INVALID',
        message: 'Invalid CSRF token',
        error: 'Forbidden',
        statusCode: 403,
      }),
    );
    const notifyUnauthorized = vi.fn();
    const refreshCsrfToken = vi.fn(
      async (): Promise<CsrfRefreshOutcome> => ({ status: 'failed' }),
    );

    const api = new ConversationsApi(
      makeConfig(refreshCsrfToken, notifyUnauthorized),
    );
    await expect(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    ).rejects.not.toBeInstanceOf(TestUnauthorizedError);

    expect(notifyUnauthorized).not.toHaveBeenCalled();
    expect(getCsrfToken()).toBe('stale-token');
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
    const notifyUnauthorized = vi.fn();

    const api = new ConversationsApi(
      makeConfig(failingRefresh, notifyUnauthorized),
    );
    await ignoreRejection(
      api.createConversation({
        createConversationDto: {
          firstMessage: 'hi',
          deploymentId: 'test-deployment',
        },
      }),
    );

    expect(notifyUnauthorized).not.toHaveBeenCalled();
    expect(getCsrfToken()).toBe('fresh-token');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(
      new Headers(fetchSpy.mock.calls[1]?.[1]?.headers).get('X-CSRF-Token'),
    ).toBe('fresh-token');
  });
});
