import {
  BadGatewayException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import { DeploymentsDetailsService } from '../deployments-details.service';

function makeService() {
  const store = new Map<string, unknown>();

  const cacheManager = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: vi.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };

  const sdkClient = {
    configurationDeployment: vi.fn(),
    getDeploymentLimits: vi.fn(),
    getModel: vi.fn(),
    getApplication: vi.fn(),
    getCustomApplication: vi.fn().mockResolvedValue({
      error: true,
      response: { status: 404 },
      data: null,
    }),
    getToolset: vi.fn(),
    getToolSetTools: vi.fn(),
  };

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const service = new DeploymentsDetailsService(
    dialClient,
    cacheManager as never,
  );

  return { service, sdkClient, cacheManager };
}

const okResponse = <T>(data: T) =>
  ({
    error: undefined,
    response: { status: 200 },
    data,
  }) as never;

const errResponse = (status: number) =>
  ({
    error: true as const,
    response: { status },
    data: undefined,
  }) as never;

describe('DeploymentsDetailsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDeploymentConfiguration', () => {
    const schema = { type: 'object', title: 'StatGPT Config', properties: {} };

    it('returns configuration schema from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      ).mockResolvedValue(okResponse(schema));

      const result = await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'token',
      );
      expect(result).toEqual(schema);
    });

    it('forwards Authorization header to DIAL Core', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'configurationDeployment')
        .mockResolvedValue(okResponse(schema));

      await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'my-token',
      );
      expect(spy).toHaveBeenCalledWith(
        'statgpt',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('encodes each deployment path segment before calling DIAL Core', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'configurationDeployment')
        .mockResolvedValue(okResponse(schema));

      await service.getDeploymentConfiguration(
        'applications/bucket/My%20App#1',
        'user-123',
        'token',
      );

      expect(spy).toHaveBeenCalledWith(
        'applications/bucket/My%20App%231',
        expect.any(Object),
      );
    });

    it('returns cached value and skips upstream on cache hit', async () => {
      const { service, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(schema);
      const spy = vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      );

      const result = await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'token',
      );
      expect(result).toEqual(schema);
      expect(spy).not.toHaveBeenCalled();
    });

    it('stores result in cache with 60 s TTL on success', async () => {
      const { service, cacheManager } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      ).mockResolvedValue(okResponse(schema));

      await service.getDeploymentConfiguration('statgpt', 'user-123', 'token');
      expect(cacheManager.set).toHaveBeenCalledWith(
        'deployments:configuration:user-123:statgpt',
        schema,
        60 * 1000,
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      ).mockResolvedValue(errResponse(404));
      await expect(
        service.getDeploymentConfiguration('unknown', 'user-123', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      ).mockRejectedValue(new TypeError('fetch failed'));
      await expect(
        service.getDeploymentConfiguration('statgpt', 'user-123', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'configurationDeployment',
      ).mockResolvedValue(errResponse(502));
      await expect(
        service.getDeploymentConfiguration('statgpt', 'user-123', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getDeploymentLimits', () => {
    const mockLimits = {
      dayTokenStats: { total: 10000, used: 4000 },
      dayCostStats: { total: 100, used: 10 },
    };

    it('returns limits from upstream', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      const result = await service.getDeploymentLimits('gpt-4o', 'token');
      expect(result).toEqual(mockLimits);
    });

    it('forwards Authorization header to DIAL Core', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      await service.getDeploymentLimits('gpt-4o', 'my-token');
      expect(sdkClient.getDeploymentLimits).toHaveBeenCalledWith(
        'gpt-4o',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('encodes each deployment path segment before calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      await service.getDeploymentLimits(
        'applications/bucket/My%20App#1',
        'token',
      );

      expect(sdkClient.getDeploymentLimits).toHaveBeenCalledWith(
        'applications/bucket/My%20App%231',
        expect.any(Object),
      );
    });

    it('does not use cache — two calls invoke upstream twice', async () => {
      const { service, sdkClient, cacheManager } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      await service.getDeploymentLimits('gpt-4o', 'token');
      await service.getDeploymentLimits('gpt-4o', 'token');

      expect(sdkClient.getDeploymentLimits).toHaveBeenCalledTimes(2);
      expect(cacheManager.get).not.toHaveBeenCalledWith(
        expect.stringContaining('limits'),
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(errResponse(404));
      await expect(
        service.getDeploymentLimits('unknown', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(
        service.getDeploymentLimits('gpt-4o', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(errResponse(502));
      await expect(
        service.getDeploymentLimits('gpt-4o', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getDeploymentDetails', () => {
    it('encodes each deployment path segment before calling DIAL Core', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({ id: 'applications/bucket/My%20App%231' }),
      );

      await service.getDeploymentDetails(
        'user1',
        'applications/bucket/My%20App#1',
        'token',
      );

      expect(sdkClient.getApplication).toHaveBeenCalledWith(
        'applications/bucket/My%20App%231',
        expect.any(Object),
      );
    });

    it('dispatches to getModel and maps capabilities/limits/pricing for a model', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(
        okResponse({
          id: 'gpt-4o',
          capabilities: { chat_completion: true, scale_types: ['standard'] },
          lifecycle_status: 'generally-available',
          tokenizer_model: 'gpt-4o',
          limits: { max_total_tokens: 128000 },
          pricing: { unit: 'token', prompt: '0.01', completion: '0.03' },
        }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'gpt-4o',
        'token',
      );

      expect(result).toEqual({
        id: 'gpt-4o',
        type: 'model',
        modelDetails: {
          capabilities: {
            completion: undefined,
            chatCompletion: true,
            embeddings: undefined,
            fineTune: undefined,
            inference: undefined,
            scaleTypes: ['standard'],
          },
          lifecycleStatus: 'generally-available',
          tokenizerModel: 'gpt-4o',
          limits: {
            maxTotalTokens: 128000,
            maxPromptTokens: undefined,
            maxCompletionTokens: undefined,
          },
          pricing: { unit: 'token', prompt: '0.01', completion: '0.03' },
        },
      });
      expect(sdkClient.getApplication).not.toHaveBeenCalled();
      expect(sdkClient.getToolset).not.toHaveBeenCalled();
    });

    it('dispatches to getApplication, maps owner/features/inputAttachmentTypes, and excludes function.env/source_folder/target_folder', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({
          id: 'applications/my-app',
          owner: 'Yauheniya Hladkaya',
          application_properties: { customFlag: true },
          application_type_schema_id: 'https://example.com/schemas/quickapp',
          input_attachment_types: [],
          features: { configuration: true, tools: false, mcp: false },
          function: {
            runtime: 'python3.11',
            status: 'DEPLOYED',
            env: { SECRET: 'value' },
            source_folder: 'src/',
            target_folder: 'dist/',
          },
          routes: { default: {} },
          editor_url: 'https://editor.example.com',
        }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'applications/my-app',
        'token',
      );

      expect(result).toEqual({
        id: 'applications/my-app',
        type: 'application',
        applicationDetails: {
          applicationProperties: { customFlag: true },
          functionRuntime: 'python3.11',
          functionStatus: 'DEPLOYED',
          routes: ['default'],
          owner: 'Yauheniya Hladkaya',
          applicationTypeSchemaId: 'https://example.com/schemas/quickapp',
          inputAttachmentTypes: [],
          features: expect.objectContaining({
            hasConfigurationSchema: true,
            tools: false,
            mcp: false,
          }),
        },
      });
      expect(JSON.stringify(result)).not.toContain('SECRET');
      expect(JSON.stringify(result)).not.toContain('editor.example.com');
    });

    it('maps display_name for an application', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({
          id: 'applications/public/finhub-via-openapi__1.0.0',
          display_name: { plainValue: 'finhub-via-openapi' },
        }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'applications/public/finhub-via-openapi__1.0.0',
        'token',
      );

      expect(result.applicationDetails?.displayName).toBe('finhub-via-openapi');
    });

    it('logs the raw DIAL Core application response and the mapped response', async () => {
      const debugSpy = vi
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);
      const { service, sdkClient } = makeService();
      sdkClient.getApplication.mockResolvedValue(
        okResponse({
          id: 'applications/public/finhub-via-openapi__1.0.0',
          display_name: { plainValue: 'finhub-via-openapi' },
        }),
      );

      await service.getDeploymentDetails(
        'user1',
        'applications/public/finhub-via-openapi__1.0.0',
        'token',
      );

      const logged = debugSpy.mock.calls.map((call) => String(call[0]));
      expect(
        logged.some((line) => line.includes('DIAL Core application details')),
      ).toBe(true);
      expect(logged.some((line) => line.includes('sent to frontend'))).toBe(
        true,
      );
      expect(logged.join('\n')).toContain('finhub-via-openapi');

      debugSpy.mockRestore();
    });

    it('dispatches to getToolset, maps owner/features/auth status, and forwards all non-secret authSettings fields', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getToolset.mockResolvedValue(
        okResponse({
          id: 'toolsets/search-tool',
          toolset: 'toolsets/search-tool',
          owner: 'Anastasiia Harkot',
          transport: 'HTTP',
          allowed_tools: ['search', 'fetch'],
          features: { mcp: true, tools: false, cache: false },
          auth_settings: {
            authentication_type: 'OAUTH',
            dynamically_registered: true,
            client_id: 'public-client-id',
            client_secret: 'super-secret',
            code_verifier: 'super-secret-verifier',
            code_challenge: 'challenge-value',
            code_challenge_method: 'S256',
            redirect_uri: 'https://chat.example.com/oauth/callback',
            token_endpoint_auth_method: 'client_secret_post',
            global_auth_status: 'SIGNED_OUT',
            app_level_auth_status: 'SIGNED_OUT',
            user_level_auth_status: 'SIGNED_IN',
            scopes_supported: ['read', 'write'],
            authorization_endpoint: 'https://mcp.example.com/oauth/authorize',
            token_endpoint: 'https://mcp.example.com/oauth/token',
          },
        }),
      );
      sdkClient.getToolSetTools.mockResolvedValue(
        okResponse({
          tools: [
            { name: 'search', title: 'Search' },
            { name: 'fetch', title: 'Fetch' },
            { name: 'browse', title: 'Browse' },
          ],
        }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'toolsets/search-tool',
        'token',
      );

      expect(result).toEqual({
        id: 'toolsets/search-tool',
        type: 'toolset',
        toolsetDetails: {
          transport: 'HTTP',
          allowedTools: ['search', 'fetch'],
          allToolNames: ['search', 'fetch', 'browse'],
          owner: 'Anastasiia Harkot',
          features: expect.objectContaining({
            mcp: true,
            tools: false,
            cache: false,
          }),
          authSettings: {
            authenticationType: 'OAUTH',
            dynamicallyRegistered: true,
            clientId: 'public-client-id',
            codeChallenge: 'challenge-value',
            codeChallengeMethod: 'S256',
            redirectUri: 'https://chat.example.com/oauth/callback',
            tokenEndpointAuthMethod: 'client_secret_post',
            globalAuthStatus: 'SIGNED_OUT',
            appLevelAuthStatus: 'SIGNED_OUT',
            userLevelAuthStatus: 'SIGNED_IN',
            scopesSupported: ['read', 'write'],
            authorizationEndpoint: 'https://mcp.example.com/oauth/authorize',
            tokenEndpoint: 'https://mcp.example.com/oauth/token',
          },
        },
      });
      expect(JSON.stringify(result)).not.toContain('super-secret');
      expect(JSON.stringify(result)).toContain('public-client-id');
    });

    it('logs the raw DIAL Core toolset response and the mapped response, redacting client_secret/code_verifier from the raw-response log', async () => {
      const debugSpy = vi
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);
      const { service, sdkClient } = makeService();
      sdkClient.getToolset.mockResolvedValue(
        okResponse({
          id: 'toolsets/search-tool',
          toolset: 'toolsets/search-tool',
          owner: 'Anastasiia Harkot',
          transport: 'HTTP',
          auth_settings: {
            authentication_type: 'OAUTH',
            client_id: 'public-client-id',
            client_secret: 'super-secret',
            code_verifier: 'super-secret-verifier',
          },
        }),
      );
      sdkClient.getToolSetTools.mockResolvedValue(errResponse(403));

      await service.getDeploymentDetails(
        'user1',
        'toolsets/search-tool',
        'token',
      );

      const logged = debugSpy.mock.calls.map((call) => String(call[0]));
      expect(logged.some((line) => line.includes('DIAL Core toolset'))).toBe(
        true,
      );
      expect(logged.some((line) => line.includes('sent to frontend'))).toBe(
        true,
      );
      expect(logged.join('\n')).not.toContain('super-secret');
      expect(logged.join('\n')).toContain('public-client-id');

      debugSpy.mockRestore();
    });

    it('omits allToolNames without failing the request when getToolSetTools errors', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getToolset.mockResolvedValue(
        okResponse({ id: 'toolsets/search-tool', transport: 'HTTP' }),
      );
      sdkClient.getToolSetTools.mockResolvedValue(errResponse(403));

      const result = await service.getDeploymentDetails(
        'user1',
        'toolsets/search-tool',
        'token',
      );

      expect(result.toolsetDetails?.allToolNames).toBeUndefined();
    });

    it('throws NotFoundException when getModel, getApplication, and getToolset all fail to find the id', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(404));
      sdkClient.getApplication.mockResolvedValue(errResponse(404));
      sdkClient.getToolset.mockResolvedValue(errResponse(404));
      await expect(
        service.getDeploymentDetails('user1', 'unknown-id', 'token'),
      ).rejects.toThrow(NotFoundException);
      expect(sdkClient.getModel).toHaveBeenCalledOnce();
      expect(sdkClient.getApplication).toHaveBeenCalledOnce();
      expect(sdkClient.getToolset).toHaveBeenCalledOnce();
    });

    it('falls back to getApplication when an unprefixed id 404s on getModel', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(404));
      sdkClient.getApplication.mockResolvedValue(
        okResponse({ id: 'root-app', owner: 'someone' }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'root-app',
        'token',
      );

      expect(result).toEqual({
        id: 'root-app',
        type: 'application',
        applicationDetails: expect.objectContaining({ owner: 'someone' }),
      });
      expect(sdkClient.getToolset).not.toHaveBeenCalled();
    });

    it('falls back to getToolset when an unprefixed id 404s on both getModel and getApplication', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(404));
      sdkClient.getApplication.mockResolvedValue(errResponse(404));
      sdkClient.getToolset.mockResolvedValue(
        okResponse({ id: 'OauthToolset-copy', owner: 'someone' }),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'OauthToolset-copy',
        'token',
      );

      expect(result).toEqual({
        id: 'OauthToolset-copy',
        type: 'toolset',
        toolsetDetails: expect.objectContaining({ owner: 'someone' }),
      });
    });

    it('throws NotFoundException instead of a TypeError when getModel resolves no error but no body', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(okResponse(undefined));
      sdkClient.getApplication.mockResolvedValue(errResponse(404));
      sdkClient.getToolset.mockResolvedValue(errResponse(404));

      await expect(
        service.getDeploymentDetails('user1', 'OauthToolset-copy', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns cached value without calling the upstream detail SDK method', async () => {
      const cachedDetails = { id: 'gpt-4o', type: 'model' as const };
      const { service, sdkClient, cacheManager } = makeService();
      cacheManager.get.mockImplementation((key: string) =>
        Promise.resolve(
          key === 'deployments:details:user1:gpt-4o'
            ? cachedDetails
            : undefined,
        ),
      );

      const result = await service.getDeploymentDetails(
        'user1',
        'gpt-4o',
        'token',
      );

      expect(result).toEqual(cachedDetails);
      expect(sdkClient.getModel).not.toHaveBeenCalled();
    });

    it('stores the mapped result in cache with a 60 s TTL', async () => {
      const { service, sdkClient, cacheManager } = makeService();
      sdkClient.getModel.mockResolvedValue(okResponse({ id: 'gpt-4o' }));

      await service.getDeploymentDetails('user1', 'gpt-4o', 'token');

      expect(cacheManager.set).toHaveBeenCalledWith(
        'deployments:details:user1:gpt-4o',
        expect.objectContaining({ id: 'gpt-4o', type: 'model' }),
        60 * 1000,
      );
    });

    it('joins an in-flight request instead of firing a second upstream call for concurrent requests', async () => {
      const { service, sdkClient } = makeService();
      let resolveModel: (value: unknown) => void = () => undefined;
      sdkClient.getModel.mockReturnValue(
        new Promise((resolve) => {
          resolveModel = resolve;
        }),
      );

      const first = service.getDeploymentDetails('user1', 'gpt-4o', 'token');
      const second = service.getDeploymentDetails('user1', 'gpt-4o', 'token');

      resolveModel(okResponse({ id: 'gpt-4o' }));
      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(sdkClient.getModel).toHaveBeenCalledOnce();
      expect(firstResult).toEqual(secondResult);
    });

    it('throws BadGatewayException when the detail upstream call returns 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockResolvedValue(errResponse(502));
      await expect(
        service.getDeploymentDetails('user1', 'gpt-4o', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException when the detail upstream call is unreachable', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getModel.mockRejectedValue(new TypeError('fetch failed'));
      await expect(
        service.getDeploymentDetails('user1', 'gpt-4o', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
