import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import type {
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '../../../openapi/openapi-response.dto';
import { ToolsetsListingService } from '../toolsets-listing.service';

/*
 * Raw DIAL Core wire response (OpenAI-compatible toolset endpoint), as
 * returned by getToolSets/getToolset before `mapDialToolsetToDto` converts
 * it to the outgoing camelCase `DialToolsetDto` shape.
 */
const rawMockToolset = {
  id: 'my-toolset',
  toolset: 'my-toolset',
  object: 'toolset',
  auth_settings: {
    authentication_type: 'OAUTH',
    client_id: 'my-client-id',
  },
};
const mockList = { data: [rawMockToolset] };
/* Toolset as it is stored in cache (after mapDialToolsetToDto is applied). */
const mockCachedToolset: DialToolsetDto = {
  id: 'my-toolset',
  toolset: 'my-toolset',
  object: 'toolset',
  displayName: 'my-toolset',
  authSettings: {
    authenticationType: 'OAUTH',
    clientId: 'my-client-id',
  },
};
const mockCachedList: DialToolsetListResponseDto = {
  data: [mockCachedToolset],
};
const mockEnrichedToolset: DialToolsetDto = {
  ...mockCachedToolset,
  isInstalled: false,
  isMy: false,
  canEdit: false,
  sharedWithMe: false,
};
const mockEnrichedList: DialToolsetListResponseDto = {
  data: [mockEnrichedToolset],
};

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number, error: unknown = {}) =>
  ({ error, response: { status } as Response }) as never;

function makeDeps() {
  const dialClient = {
    client: {
      getToolSets: vi.fn(),
      getToolset: vi.fn(),
      getCustomToolSet: vi.fn(),
      getUserBucket: vi.fn(),
      saveToolSet: vi.fn(),
      deleteToolSet: vi.fn(),
      toolsetSignin: vi.fn(),
      toolSetSignout: vi.fn(),
      getSharedResources: vi
        .fn()
        .mockResolvedValue(okResponse({ resources: [] })),
    },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const cacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  };

  const userConfigService = {
    getInstalledIds: vi
      .fn()
      .mockResolvedValue({ toolsets: [], deployments: [] }),
  };

  const deploymentsService = {
    invalidateDetailsCache: vi.fn().mockResolvedValue(undefined),
  };

  return { dialClient, cacheManager, userConfigService, deploymentsService };
}

function makeService() {
  const { dialClient, cacheManager, userConfigService, deploymentsService } =
    makeDeps();
  const service = new ToolsetsListingService(
    dialClient,
    cacheManager as never,
    userConfigService as never,
    deploymentsService as never,
  );
  return { service, cacheManager, userConfigService, deploymentsService };
}

describe('ToolsetsListingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listToolsets', () => {
    it('returns list from upstream on cache miss', async () => {
      const { service } = makeService();
      const upstreamList = { ...mockList, object: 'list' };
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(upstreamList),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result).toEqual(mockEnrichedList);
    });

    it('filters hidden .dial_folder toolsets from upstream list', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse({
          data: [
            rawMockToolset,
            {
              id: 'toolsets/bucket/.dial_folder',
              toolset: 'toolsets/bucket/.dial_folder',
              object: 'toolset',
            },
          ],
        }),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data).toEqual([mockEnrichedToolset]);
    });

    it('returns cached list without calling upstream on cache hit', async () => {
      const { dialClient, userConfigService, deploymentsService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockCachedList),
        set: vi.fn(),
      };
      const service = new ToolsetsListingService(
        dialClient,
        cacheManager as never,
        userConfigService as never,
        deploymentsService as never,
      );
      const spy = vi
        .spyOn(service['dialClient'].client, 'getToolSets')
        .mockResolvedValue(okResponse(mockList));

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result).toEqual(mockEnrichedList);
      expect(spy).not.toHaveBeenCalled();
    });

    it('sets isInstalled=true for installed toolsets from user config', async () => {
      const { service, userConfigService } = makeService();
      userConfigService.getInstalledIds.mockResolvedValue({
        toolsets: ['my-toolset'],
        deployments: [],
      });
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0]).toMatchObject({
        id: 'my-toolset',
        isInstalled: true,
        isMy: false,
      });
    });

    it('sets isMy=true when bucket appears as a toolset path segment', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse({
          data: [
            {
              ...rawMockToolset,
              id: 'toolsets/bucket/my-toolset',
              toolset: 'toolsets/bucket/my-toolset',
            },
          ],
        }),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0]).toMatchObject({
        id: 'toolsets/bucket/my-toolset',
        isInstalled: false,
        isMy: true,
      });
    });

    it('sets isMy=false when the bucket only matches the toolset-name segment, not the bucket segment', async () => {
      /*
       * Regression: a toolset at toolsets/OTHER_BUCKET/bucket must not be
       * misclassified as owned by "bucket" just because that value happens
       * to appear as the toolset-name segment rather than the bucket
       * segment (path index 1).
       */
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse({
          data: [
            {
              ...rawMockToolset,
              id: 'toolsets/OTHER_BUCKET/bucket',
              toolset: 'toolsets/OTHER_BUCKET/bucket',
            },
          ],
        }),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0]).toMatchObject({
        id: 'toolsets/OTHER_BUCKET/bucket',
        isMy: false,
      });
    });

    it('sets canEdit=true for a shared toolset with WRITE permission', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(
        okResponse({
          resources: [{ url: 'my-toolset', permissions: ['READ', 'WRITE'] }],
        }),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0]).toMatchObject({
        id: 'my-toolset',
        isMy: false,
        canEdit: true,
      });
    });

    it('sets canEdit=false for a shared toolset with READ-only permission', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(
        okResponse({
          resources: [{ url: 'my-toolset', permissions: ['READ'] }],
        }),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0]).toMatchObject({
        id: 'my-toolset',
        isMy: false,
        canEdit: false,
      });
    });

    it('sets sharedWithMe=false for an owned toolset, even if a share grant is also returned', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse({
          data: [
            {
              ...rawMockToolset,
              id: 'toolsets/bucket/my-toolset',
              toolset: 'toolsets/bucket/my-toolset',
            },
          ],
        }),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(
        okResponse({
          resources: [
            {
              url: 'toolsets/bucket/my-toolset',
              permissions: ['READ', 'WRITE'],
            },
          ],
        }),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0]).toMatchObject({
        isMy: true,
        sharedWithMe: false,
      });
    });

    it('sets sharedWithMe=true for a READ-only shared toolset', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(
        okResponse({
          resources: [{ url: 'my-toolset', permissions: ['READ'] }],
        }),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0]).toMatchObject({
        isMy: false,
        sharedWithMe: true,
      });
    });

    it('sets sharedWithMe=true for a WRITE-shared toolset', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(
        okResponse({
          resources: [{ url: 'my-toolset', permissions: ['WRITE'] }],
        }),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0]).toMatchObject({
        sharedWithMe: true,
        canEdit: true,
      });
    });

    it('sets sharedWithMe=false for a public/organization toolset not returned by getSharedResources', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(okResponse({ resources: [] }));

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0].sharedWithMe).toBe(false);
    });

    it('degrades sharedWithMe to false when getSharedResources fails', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockRejectedValue(new Error('boom'));

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0].sharedWithMe).toBe(false);
    });

    it('logs and degrades to false when getSharedResources returns an error response', async () => {
      const { service } = makeService();
      const warnSpy = vi.spyOn(service['logger'], 'warn');
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        error: {},
        response: { status: 503 },
      } as never);

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');

      expect(result.data[0].sharedWithMe).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to resolve shared toolset resources: status=503',
      );
    });

    /*
     * One call, not two: `with: 'me'` derives canEdit/sharedWithMe list-wide,
     * and the mirror-image `with: 'others'` query that used to derive a
     * per-toolset recipient count is now `GET /api/v1/share/recipients`, issued
     * only when an owner opens the menu offering "Revoke access".
     */
    it('resolves canEdit and sharedWithMe from exactly one getSharedResources call', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );
      const sharedResourcesSpy = vi
        .spyOn(service['dialClient'].client, 'getSharedResources')
        .mockResolvedValue(
          okResponse({
            resources: [{ url: 'my-toolset', permissions: ['WRITE'] }],
          }),
        );

      await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(sharedResourcesSpy).toHaveBeenCalledOnce();
      expect(sharedResourcesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            resourceTypes: ['TOOL_SET'],
            with: 'me',
          }),
        }),
      );
    });

    it('uses per-user cache keys — different users get different cache entries', async () => {
      const { dialClient, userConfigService, deploymentsService } = makeDeps();
      const store = new Map<string, unknown>();
      const cacheManager = {
        get: vi.fn((key: string) => Promise.resolve(store.get(key))),
        set: vi.fn((key: string, value: unknown) => {
          store.set(key, value);
          return Promise.resolve();
        }),
      };
      const service = new ToolsetsListingService(
        dialClient,
        cacheManager as never,
        userConfigService as never,
        deploymentsService as never,
      );
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );

      await service.listToolsets('user1', 'token1', 'bucket');
      await service.listToolsets('user2', 'token2', 'bucket');

      expect(cacheManager.get).toHaveBeenCalledWith('toolsets:list:user1');
      expect(cacheManager.get).toHaveBeenCalledWith('toolsets:list:user2');
    });

    it('forwards Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getToolSets')
        .mockResolvedValue(okResponse(mockList));

      await service.listToolsets('user1', 'my-token', 'bucket');
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.listToolsets('u', 't', 'bucket')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.listToolsets('u', 't', 'bucket')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on upstream 429', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        errResponse(429),
      );
      await expect(service.listToolsets('u', 't', 'bucket')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        errResponse(500),
      );
      await expect(service.listToolsets('u', 't', 'bucket')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.listToolsets('u', 't', 'bucket')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('redacts client_secret from list items', async () => {
      const { service } = makeService();
      const toolsetWithSecret = {
        ...rawMockToolset,
        auth_settings: {
          authentication_type: 'OAUTH',
          client_id: 'id',
          client_secret: 'secret-value',
        },
      };
      vi.spyOn(service['dialClient'].client, 'getToolSets').mockResolvedValue(
        okResponse({ data: [toolsetWithSecret] }),
      );

      const result = await service.listToolsets('user1', 'token', 'bucket');
      expect(result.data[0].authSettings).toEqual({
        authenticationType: 'OAUTH',
        clientId: 'id',
      });
      expect(
        (result.data[0].authSettings as { clientSecret?: string }).clientSecret,
      ).toBeUndefined();
    });
  });

  describe('getToolset', () => {
    it('returns toolset from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        okResponse(rawMockToolset),
      );

      const result = await service.getToolset(
        'user1',
        'token-abc',
        'bucket',
        'my-toolset',
      );
      expect(result).toEqual(mockEnrichedToolset);
    });

    it('returns cached toolset without calling upstream on cache hit', async () => {
      const { dialClient, userConfigService, deploymentsService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockCachedToolset),
        set: vi.fn(),
      };
      const service = new ToolsetsListingService(
        dialClient,
        cacheManager as never,
        userConfigService as never,
        deploymentsService as never,
      );
      const spy = vi
        .spyOn(service['dialClient'].client, 'getToolset')
        .mockResolvedValue(okResponse(rawMockToolset));

      const result = await service.getToolset(
        'user1',
        'token-abc',
        'bucket',
        'my-toolset',
      );
      expect(result).toEqual(mockEnrichedToolset);
      expect(spy).not.toHaveBeenCalled();
    });

    it('sets ownership fields for a single toolset', async () => {
      const { service, userConfigService } = makeService();
      const id = 'toolsets/bucket/my-toolset';
      userConfigService.getInstalledIds.mockResolvedValue({
        toolsets: [id],
        deployments: [],
      });
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        okResponse({
          ...rawMockToolset,
          id,
          toolset: id,
        }),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getCustomToolSet',
      ).mockResolvedValue(
        okResponse({
          displayName: 'My toolset',
          endpoint: 'https://my-toolset.example.com/mcp',
          transport: 'HTTP',
        }),
      );

      const result = await service.getToolset(
        'user1',
        'token-abc',
        'bucket',
        id,
      );
      expect(result).toMatchObject({
        id,
        isInstalled: true,
        isMy: true,
      });
    });

    it('sets sharedWithMe=true for a single READ-only shared toolset', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        okResponse(rawMockToolset),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(
        okResponse({
          resources: [{ url: 'my-toolset', permissions: ['READ'] }],
        }),
      );

      const result = await service.getToolset(
        'user1',
        'token-abc',
        'bucket',
        'my-toolset',
      );
      expect(result).toMatchObject({ isMy: false, sharedWithMe: true });
    });

    it('loads a prefixed toolset from the custom resource so saved endpoint is returned', async () => {
      const { service } = makeService();
      const id = 'toolsets/bucket/my-toolset';
      const customSpy = vi
        .spyOn(service['dialClient'].client, 'getCustomToolSet')
        .mockResolvedValue(
          okResponse({
            displayName: 'My toolset',
            displayVersion: '1.0.0',
            endpoint: 'https://my-toolset.example.com/mcp',
            transport: 'SSE',
            authSettings: {
              authentication_type: 'OAUTH',
              dynamically_registered: true,
              client_id: 'client-from-custom-resource',
              client_secret: 'secret-value',
              authorization_endpoint: 'https://auth.example.com/authorize',
              token_endpoint: 'https://auth.example.com/token',
              scopes_supported: ['read', 'write'],
              code_challenge: 'challenge-value',
              code_challenge_method: 'S256',
            },
          }),
        );
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        okResponse({
          id,
          toolset: id,
          object: 'toolset',
          auth_settings: {
            authentication_type: 'OAUTH',
            user_level_auth_status: 'SIGNED_IN',
          },
        }),
      );

      const result = await service.getToolset('user1', 'token', 'bucket', id);

      expect(customSpy).toHaveBeenCalledWith(
        'bucket',
        'my-toolset',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
      expect(result).toMatchObject({
        id,
        toolset: id,
        endpoint: 'https://my-toolset.example.com/mcp',
        transport: 'SSE',
        displayName: 'My toolset',
      });
      expect(result.authSettings).toMatchObject({
        authenticationType: 'OAUTH',
        dynamicallyRegistered: true,
        clientId: 'client-from-custom-resource',
        authorizationEndpoint: 'https://auth.example.com/authorize',
        tokenEndpoint: 'https://auth.example.com/token',
        scopesSupported: ['read', 'write'],
        codeChallenge: 'challenge-value',
        codeChallengeMethod: 'S256',
        userLevelAuthStatus: 'SIGNED_IN',
      });
      expect(
        (result.authSettings as { clientSecret?: string }).clientSecret,
      ).toBeUndefined();
    });

    it('loads a saved API key header from the custom resource', async () => {
      const { service } = makeService();
      const id = 'toolsets/bucket/api-toolset';
      vi.spyOn(
        service['dialClient'].client,
        'getCustomToolSet',
      ).mockResolvedValue(
        okResponse({
          displayName: 'API toolset',
          endpoint: 'https://api-toolset.example.com/mcp',
          transport: 'HTTP',
          authSettings: {
            authentication_type: 'API_KEY',
            api_key_header: 'X-Api-Key',
          },
        }),
      );
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        okResponse({
          id,
          toolset: id,
          object: 'toolset',
          auth_settings: {
            authentication_type: 'API_KEY',
            user_level_auth_status: 'SIGNED_OUT',
          },
        }),
      );

      const result = await service.getToolset('user1', 'token', 'bucket', id);

      expect(result.authSettings).toMatchObject({
        authenticationType: 'API_KEY',
        apiKeyHeader: 'X-Api-Key',
        userLevelAuthStatus: 'SIGNED_OUT',
      });
    });

    it('uses per-user per-toolset cache key', async () => {
      const { service, cacheManager } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        okResponse(rawMockToolset),
      );

      await service.getToolset('user1', 'token', 'bucket', 'my-toolset');
      expect(cacheManager.get).toHaveBeenCalledWith(
        'toolsets:single:user1:my-toolset',
      );
    });

    it('forwards toolset name and Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getToolset')
        .mockResolvedValue(okResponse(rawMockToolset));

      await service.getToolset('user1', 'my-token', 'bucket', 'my-toolset');
      expect(spy).toHaveBeenCalledWith(
        'my-toolset',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('redacts client_secret before caching and returning', async () => {
      const { service, cacheManager } = makeService();
      const toolsetWithSecret = {
        ...rawMockToolset,
        auth_settings: {
          authentication_type: 'OAUTH',
          client_id: 'id',
          client_secret: 'secret-value',
        },
      };
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        okResponse(toolsetWithSecret),
      );

      const result = await service.getToolset(
        'user1',
        'token',
        'bucket',
        'my-toolset',
      );
      expect(
        (result.authSettings as { clientSecret?: string }).clientSecret,
      ).toBeUndefined();
      expect(cacheManager.set).toHaveBeenCalledWith(
        'toolsets:single:user1:my-toolset',
        expect.objectContaining({
          authSettings: expect.not.objectContaining({
            clientSecret: expect.anything(),
          }),
        }),
        60 * 1000,
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        errResponse(404),
      );
      await expect(
        service.getToolset('u', 't', 'bucket', 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        errResponse(401),
      );
      await expect(
        service.getToolset('u', 't', 'bucket', 'my-toolset'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        errResponse(403),
      );
      await expect(
        service.getToolset('u', 't', 'bucket', 'my-toolset'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        errResponse(502),
      );
      await expect(
        service.getToolset('u', 't', 'bucket', 'my-toolset'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getToolset').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(
        service.getToolset('u', 't', 'bucket', 'my-toolset'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('resolveToolsetItem', () => {
    it('resolves the caller bucket then delegates to getToolset', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        okResponse({ bucket: 'test-bucket' }),
      );
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        okResponse(rawMockToolset),
      );

      const result = await service.resolveToolsetItem(
        'user1',
        'token-abc',
        'my-toolset',
      );

      expect(result).toEqual(mockEnrichedToolset);
    });

    it('returns null when getToolset 404s (no such toolset / no access)', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        okResponse({ bucket: 'test-bucket' }),
      );
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        errResponse(404),
      );

      const result = await service.resolveToolsetItem(
        'user1',
        'token-abc',
        'unknown-toolset',
      );

      expect(result).toBeNull();
    });

    it('throws on a genuine upstream 5xx rather than returning null', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        okResponse({ bucket: 'test-bucket' }),
      );
      vi.spyOn(service['dialClient'].client, 'getToolset').mockResolvedValue(
        errResponse(502),
      );

      await expect(
        service.resolveToolsetItem('user1', 'token-abc', 'my-toolset'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
