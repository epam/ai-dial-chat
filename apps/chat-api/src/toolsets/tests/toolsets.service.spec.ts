import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import type {
  DialToolsetDto,
  DialToolsetListResponseDto,
} from '../../openapi/openapi-response.dto';
import { ToolsetCredentialsLevel } from '../dto/toolset-auth.dto';
import {
  ToolsetAuthType,
  ToolsetTransport,
  type ToolsetBodyDto,
} from '../dto/toolset-body.dto';
import { ToolsetsService } from '../toolsets.service';

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
  const service = new ToolsetsService(
    dialClient,
    cacheManager as never,
    userConfigService as never,
    deploymentsService as never,
  );
  return { service, cacheManager, userConfigService, deploymentsService };
}

describe('ToolsetsService', () => {
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
      const service = new ToolsetsService(
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
      const service = new ToolsetsService(
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
      const service = new ToolsetsService(
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

function makeWriteService() {
  const { dialClient, userConfigService, deploymentsService } = makeDeps();
  const cacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  };
  const service = new ToolsetsService(
    dialClient,
    cacheManager as never,
    userConfigService as never,
    deploymentsService as never,
  );
  return { service, cacheManager, deploymentsService };
}

const bucketSdkOk = okResponse({ bucket: 'test-bucket' });
const mutationSdkOk = okResponse({});

const baseBody: ToolsetBodyDto = {
  name: 'My toolset',
  endpoint: 'https://my-toolset.example.com/mcp',
  transport: ToolsetTransport.Http,
  authSettings: { authenticationType: ToolsetAuthType.None },
};

describe('ToolsetsService — write operations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createToolset', () => {
    it('creates toolset, returns composite id, and invalidates the list cache', async () => {
      const { service, cacheManager } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      vi.spyOn(service['dialClient'].client, 'saveToolSet').mockResolvedValue(
        mutationSdkOk,
      );

      const result = await service.createToolset('user1', 'token', baseBody);
      expect(result).toEqual({
        id: 'toolsets/test-bucket/My%20toolset__0.0.1',
      });
      expect(cacheManager.del).toHaveBeenCalledWith('toolsets:list:user1');
    });

    it('encodes slashes inside the display name as filename characters', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      const result = await service.createToolset('user1', 'token', {
        ...baseBody,
        name: 'Team/toolset',
      });

      expect(result).toEqual({
        id: 'toolsets/test-bucket/Team%2Ftoolset__0.0.1',
      });
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'Team%2Ftoolset__0.0.1',
        expect.any(Object),
      );
    });

    it('maps fields to the DIAL Core PUT body shape', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        description: 'desc',
        iconUrl: 'https://example.com/icon.svg',
        topics: ['a', 'b'],
        allowedTools: ['tool1'],
        authSettings: {
          authenticationType: ToolsetAuthType.ApiKey,
          apiKeyHeader: 'X-Api-Key',
        },
      });

      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20toolset__0.0.1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
      const sentBody = saveSpy.mock.calls[0][2].body as Record<string, unknown>;
      expect(sentBody).toEqual({
        displayName: 'My toolset',
        displayVersion: '0.0.1',
        endpoint: 'https://my-toolset.example.com/mcp',
        transport: 'HTTP',
        allowed_tools: ['tool1'],
        description: 'desc',
        iconUrl: 'https://example.com/icon.svg',
        descriptionKeywords: ['a', 'b'],
        authSettings: {
          authentication_type: 'API_KEY',
          api_key_header: 'X-Api-Key',
        },
      });
    });

    it('maps intro to the top-level intro field in the PUT body', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        intro: 'A short pitch',
      });

      const sentBody = saveSpy.mock.calls[0][2].body as Record<string, unknown>;
      expect(sentBody.intro).toBe('A short pitch');
    });

    it('maps OAuth config fields to the DIAL Core PUT body', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          clientId: 'client-id',
          clientSecret: 'client-secret',
          authorizationEndpoint: 'https://auth.example.com/authorize',
          tokenEndpoint: 'https://auth.example.com/token',
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
          scopesSupported: ['read', 'write'],
        },
      });

      const sentBody = saveSpy.mock.calls[0][2].body as {
        authSettings: Record<string, unknown>;
      };
      expect(sentBody.authSettings).toEqual({
        authentication_type: 'OAUTH',
        client_id: 'client-id',
        client_secret: 'client-secret',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        scopes_supported: ['read', 'write'],
        redirect_uri: 'https://chat.example.com/auth/toolset-signin',
      });
    });

    it('maps OAuth with-login redirect URI without requiring configured endpoints', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
        },
      });

      const sentBody = saveSpy.mock.calls[0][2].body as {
        authSettings: Record<string, unknown>;
      };
      expect(sentBody.authSettings).toEqual({
        authentication_type: 'OAUTH',
        redirect_uri: 'https://chat.example.com/auth/toolset-signin',
      });
    });

    it('allows configured OAuth without authorization and token endpoints (DIAL Core decides if that is enough)', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          clientId: 'client-id',
          clientSecret: 'client-secret',
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
          scopesSupported: ['read', 'write'],
        },
      });

      expect(saveSpy).toHaveBeenCalledOnce();
    });

    it('does not set intro when it is omitted', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', baseBody);

      const sentBody = saveSpy.mock.calls[0][2].body as Record<string, unknown>;
      expect(sentBody).not.toHaveProperty('intro');
    });

    it('throws UnauthorizedException when the bucket call returns 401', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.createToolset('u', 't', baseBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not invalidate cache when the PUT returns an error', async () => {
      const { service, cacheManager } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      vi.spyOn(service['dialClient'].client, 'saveToolSet').mockResolvedValue(
        errResponse(409),
      );
      await expect(
        service.createToolset('user1', 't', baseBody),
      ).rejects.toThrow();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.createToolset('u', 't', baseBody)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('updateToolset', () => {
    const id = 'toolsets/test-bucket/My%20toolset__0.0.1';

    it('PUTs to the toolset id path and invalidates list + single caches', async () => {
      const { service, cacheManager } = makeWriteService();
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      const result = await service.updateToolset(
        'user1',
        'token',
        id,
        baseBody,
      );
      expect(result).toEqual({ id });
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20toolset__0.0.1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
          body: expect.objectContaining({
            displayName: 'My toolset',
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith('toolsets:list:user1');
      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('preserves hidden OAuth auth settings when update omits a new client secret', async () => {
      const { service } = makeWriteService();
      const customSpy = vi
        .spyOn(service['dialClient'].client, 'getCustomToolSet')
        .mockResolvedValue(
          okResponse({
            authSettings: {
              authentication_type: 'OAUTH',
              client_secret: 'existing-secret',
              code_verifier: 'existing-code-verifier',
              token_endpoint_auth_method: 'client_secret_post',
            },
          }),
        );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.updateToolset('user1', 'token', id, {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          clientId: 'updated-client',
          authorizationEndpoint: 'https://auth.example.com/authorize',
          tokenEndpoint: 'https://auth.example.com/token',
          scopesSupported: ['read', 'write'],
        },
      });

      expect(customSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20toolset__0.0.1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
      const sentBody = saveSpy.mock.calls[0][2].body as {
        authSettings: Record<string, unknown>;
      };
      expect(sentBody.authSettings).toMatchObject({
        authentication_type: 'OAUTH',
        client_id: 'updated-client',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        scopes_supported: ['read', 'write'],
        client_secret: 'existing-secret',
      });
      expect(sentBody.authSettings).not.toHaveProperty('code_verifier');
      expect(sentBody.authSettings).not.toHaveProperty(
        'token_endpoint_auth_method',
      );
    });

    it('preserves the full stored OAuth config when update saves OAuth with-login only', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomToolSet',
      ).mockResolvedValue(
        okResponse({
          authSettings: {
            authentication_type: 'OAUTH',
            client_id: 'existing-client',
            client_secret: 'existing-secret',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            scopes_supported: ['read', 'write'],
            code_verifier: 'existing-code-verifier',
            token_endpoint_auth_method: 'client_secret_post',
          },
        }),
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.updateToolset('user1', 'token', id, {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
        },
      });

      const sentBody = saveSpy.mock.calls[0][2].body as {
        authSettings: Record<string, unknown>;
      };
      expect(sentBody.authSettings).toEqual({
        authentication_type: 'OAUTH',
        client_id: 'existing-client',
        client_secret: 'existing-secret',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        scopes_supported: ['read', 'write'],
        redirect_uri: 'https://chat.example.com/auth/toolset-signin',
      });
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'saveToolSet').mockResolvedValue(
        errResponse(404),
      );
      await expect(
        service.updateToolset('u', 't', id, baseBody),
      ).rejects.toThrow(NotFoundException);
    });

    it('surfaces the DIAL Core error message (plain string body) on a rejected save', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'saveToolSet').mockResolvedValue(
        errResponse(
          400,
          "Connection failed: The specified endpoint 'https://test.com' is invalid or unreachable.",
        ),
      );
      await expect(
        service.updateToolset('u', 't', id, baseBody),
      ).rejects.toThrow(
        "Connection failed: The specified endpoint 'https://test.com' is invalid or unreachable.",
      );
    });

    it('surfaces the DIAL Core error message (object body with a message field) on a rejected save', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'saveToolSet').mockResolvedValue(
        errResponse(400, { message: 'Display name already in use' }),
      );
      await expect(
        service.updateToolset('u', 't', id, baseBody),
      ).rejects.toThrow('Display name already in use');
    });
  });

  describe('deleteToolset', () => {
    const id = 'toolsets/test-bucket/My%20toolset__0.0.1';

    it('DELETEs the toolset id path and invalidates caches', async () => {
      const { service, cacheManager } = makeWriteService();
      const deleteSpy = vi
        .spyOn(service['dialClient'].client, 'deleteToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.deleteToolset('user1', 'token', id);
      expect(deleteSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20toolset__0.0.1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'deleteToolSet').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.deleteToolset('u', 't', id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('loginToolset', () => {
    const id = 'toolsets/test-bucket/My%20toolset__0.0.1';

    it('posts API key credentials to the signin endpoint', async () => {
      const { service } = makeWriteService();
      const signinSpy = vi
        .spyOn(service['dialClient'].client, 'toolsetSignin')
        .mockResolvedValue(mutationSdkOk);

      await service.loginToolset('user1', 'token', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthType.ApiKey,
        apiKey: 'secret-key',
      });

      expect(signinSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
      const sentBody = signinSpy.mock.calls[0][0].body as Record<
        string,
        unknown
      >;
      expect(sentBody.apiKey).toBe('secret-key');
      expect(sentBody.code).toBeUndefined();
    });

    it('posts OAuth code + redirectUri to the signin endpoint', async () => {
      const { service } = makeWriteService();
      const signinSpy = vi
        .spyOn(service['dialClient'].client, 'toolsetSignin')
        .mockResolvedValue(mutationSdkOk);

      await service.loginToolset('user1', 'token', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthType.OAuth,
        code: 'auth-code',
        redirectUri: 'https://chat.example.com/toolset-editor/callback',
      });

      const sentBody = signinSpy.mock.calls[0][0].body as Record<
        string,
        unknown
      >;
      expect(sentBody.code).toBe('auth-code');
      expect(sentBody.redirectUri).toBe(
        'https://chat.example.com/toolset-editor/callback',
      );
      expect(sentBody.apiKey).toBeUndefined();
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'toolsetSignin').mockResolvedValue(
        errResponse(401),
      );
      await expect(
        service.loginToolset('u', 't', id, {
          url: id,
          credentialsLevel: ToolsetCredentialsLevel.User,
          authenticationType: ToolsetAuthType.ApiKey,
          apiKey: 'k',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logoutToolset', () => {
    const id = 'toolsets/test-bucket/My%20toolset__0.0.1';

    it('posts to the signout endpoint and invalidates caches', async () => {
      const { service, cacheManager } = makeWriteService();
      const signoutSpy = vi
        .spyOn(service['dialClient'].client, 'toolSetSignout')
        .mockResolvedValue(mutationSdkOk);

      await service.logoutToolset('user1', 'token', 'test-bucket', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthType.OAuth,
      });

      expect(signoutSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
          body: expect.objectContaining({
            authenticationType: ToolsetAuthType.OAuth,
            credentialsLevel: ToolsetCredentialsLevel.User,
            url: id,
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('maps the App credentials level to the DIAL Core APPLICATION value', async () => {
      const { service } = makeWriteService();
      const signoutSpy = vi
        .spyOn(service['dialClient'].client, 'toolSetSignout')
        .mockResolvedValue(mutationSdkOk);

      await service.logoutToolset('user1', 'token', 'test-bucket', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.App,
        authenticationType: ToolsetAuthType.ApiKey,
      });

      expect(signoutSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            credentialsLevel: 'APPLICATION',
          }),
        }),
      );
    });

    it('treats an upstream 404 as an already-signed-out no-op instead of an error', async () => {
      const { service, cacheManager } = makeWriteService();
      vi.spyOn(
        service['dialClient'].client,
        'toolSetSignout',
      ).mockResolvedValue(errResponse(404));

      await service.logoutToolset('user1', 'token', 'test-bucket', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.Global,
        authenticationType: ToolsetAuthType.OAuth,
      });

      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('still throws for a non-404 upstream error', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        service['dialClient'].client,
        'toolSetSignout',
      ).mockResolvedValue(errResponse(401));

      await expect(
        service.logoutToolset('user1', 'token', 'test-bucket', id, {
          url: id,
          credentialsLevel: ToolsetCredentialsLevel.User,
          authenticationType: ToolsetAuthType.OAuth,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('resolves the authentication type from the stored toolset when the body omits it', async () => {
      const { service, cacheManager } = makeWriteService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomToolSet',
      ).mockResolvedValue(
        okResponse({
          displayName: 'My toolset',
          authSettings: { authentication_type: 'OAUTH' },
        }),
      );
      const signoutSpy = vi
        .spyOn(service['dialClient'].client, 'toolSetSignout')
        .mockResolvedValue(mutationSdkOk);

      await service.logoutToolset('user1', 'token', 'test-bucket', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.User,
      });

      expect(signoutSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            authenticationType: ToolsetAuthType.OAuth,
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('rejects when the body omits authenticationType and the stored toolset has none supported', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomToolSet',
      ).mockResolvedValue(
        okResponse({
          displayName: 'My toolset',
          authSettings: { authentication_type: 'NONE' },
        }),
      );

      await expect(
        service.logoutToolset('user1', 'token', 'test-bucket', id, {
          url: id,
          credentialsLevel: ToolsetCredentialsLevel.User,
        }),
      ).rejects.toThrow('Unsupported toolset authentication type');
    });
  });
});
