import {
  ConversationsApi,
  DeploymentsApi,
  ModelsApi,
} from '@epam/ai-dial-chat-api-client';
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

describe('createApiConfiguration', () => {
  it.each(['list', 'detail'] as const)(
    'deserializes normalized supported interfaces through the normal catalog %s method',
    async (kind) => {
      const entry = {
        id: 'mixed',
        object: 'model',
        supportedInterfaces: [
          'openaiChatCompletions',
          'openaiResponses',
          'anthropicMessages',
        ],
      };
      global.fetch = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          makeResponse(200, kind === 'list' ? { data: [entry] } : entry),
        );
      const api = new ModelsApi(createApiConfiguration());
      const result =
        kind === 'list'
          ? (await api.listModelCatalog()).data[0]
          : await api.getModelCatalogEntry({ modelName: 'mixed' });
      expect(result.supportedInterfaces).toEqual(entry.supportedInterfaces);
    },
  );

  it.each([
    { chatCompletion: true, responsesApi: true, anthropicMessages: true },
    { chatCompletion: false, responsesApi: false, anthropicMessages: true },
    { chatCompletion: true },
  ])('deserializes optional detail capabilities %#', async (features) => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      makeResponse(200, {
        id: 'selected',
        type: 'model',
        modelDetails: { features },
      }),
    );
    const api = new DeploymentsApi(createApiConfiguration());
    const result = await api.getDeploymentDetails({ deployment: 'selected' });
    expect(result.modelDetails?.features).toMatchObject(features);
    expect(result.modelDetails?.features?.anthropicMessages).toBe(
      features.anthropicMessages,
    );
  });

  it('accepts legacy catalog metadata without supported-interface fields', async () => {
    global.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        makeResponse(200, { data: [{ id: 'legacy', object: 'model' }] }),
      );
    expect(
      (await new ModelsApi(createApiConfiguration()).listModelCatalog()).data[0]
        .supportedInterfaces,
    ).toBeUndefined();
  });

  afterEach(() => {
    setCsrfToken(null);
    vi.restoreAllMocks();
  });

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
