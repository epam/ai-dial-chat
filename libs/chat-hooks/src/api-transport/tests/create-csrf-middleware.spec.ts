import {
  Configuration,
  ConversationsApi,
  ModelsApi,
} from '@epam/ai-dial-chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCsrfMiddleware } from '../create-csrf-middleware';

let csrfToken: string | null = null;
const getCsrfToken = () => csrfToken;
const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};

const makeConfig = () =>
  new Configuration({
    basePath: '',
    credentials: 'include',
    middleware: [createCsrfMiddleware({ getCsrfToken, setCsrfToken })],
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

describe('createCsrfMiddleware', () => {
  it('injects X-CSRF-Token header on POST when token is set', async () => {
    setCsrfToken('test-token');
    const fetchSpy = setupFetch(200);
    const api = new ConversationsApi(makeConfig());

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
    const api = new ModelsApi(makeConfig());

    await ignoreRejection(api.listModels());

    expect(getLastRequestHeaders(fetchSpy).get('X-CSRF-Token')).toBeNull();
  });

  it('does not inject X-CSRF-Token when token is null', async () => {
    const fetchSpy = setupFetch(200);
    const api = new ConversationsApi(makeConfig());

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
    const api = new ConversationsApi(makeConfig());

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
