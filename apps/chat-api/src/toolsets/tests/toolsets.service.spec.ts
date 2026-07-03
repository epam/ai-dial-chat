import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
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

const mockToolset: DialToolsetDto = {
  id: 'my-toolset',
  toolset: 'my-toolset',
  object: 'toolset',
  auth_settings: {
    authentication_type: 'OAUTH',
    client_id: 'my-client-id',
  },
};
const mockList: DialToolsetListResponseDto = { data: [mockToolset] };
const mockEnrichedToolset: DialToolsetDto = {
  ...mockToolset,
  is_installed: false,
  is_my: false,
};
const mockEnrichedList: DialToolsetListResponseDto = {
  data: [mockEnrichedToolset],
};

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

function makeDeps() {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  const cacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  };

  const userConfigService = {
    getInstalledIds: vi
      .fn()
      .mockResolvedValue({ toolsets: [], deployments: [] }),
  };

  return { configService, cacheManager, userConfigService };
}

function makeService() {
  const { configService, cacheManager, userConfigService } = makeDeps();
  const service = new ToolsetsService(
    configService,
    cacheManager as never,
    userConfigService as never,
  );
  return { service, cacheManager, userConfigService };
}

describe('ToolsetsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listToolsets', () => {
    it('returns list from upstream on cache miss', async () => {
      const { service } = makeService();
      const upstreamList = { ...mockList, object: 'list' };
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        okResponse(upstreamList),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result).toEqual(mockEnrichedList);
    });

    it('filters hidden .dial_folder toolsets from upstream list', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        okResponse({
          data: [
            mockToolset,
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
      const { configService, userConfigService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockList),
        set: vi.fn(),
      };
      const service = new ToolsetsService(
        configService,
        cacheManager as never,
        userConfigService as never,
      );
      const spy = vi
        .spyOn(service['client'], 'getToolSets')
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
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0]).toMatchObject({
        id: 'my-toolset',
        is_installed: true,
        is_my: false,
      });
    });

    it('sets isMy=true when bucket appears as a toolset path segment', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        okResponse({
          data: [
            {
              ...mockToolset,
              id: 'toolsets/bucket/my-toolset',
              toolset: 'toolsets/bucket/my-toolset',
            },
          ],
        }),
      );

      const result = await service.listToolsets('user1', 'token-abc', 'bucket');
      expect(result.data[0]).toMatchObject({
        id: 'toolsets/bucket/my-toolset',
        is_installed: false,
        is_my: true,
      });
    });

    it('uses per-user cache keys — different users get different cache entries', async () => {
      const { configService, userConfigService } = makeDeps();
      const store = new Map<string, unknown>();
      const cacheManager = {
        get: vi.fn((key: string) => Promise.resolve(store.get(key))),
        set: vi.fn((key: string, value: unknown) => {
          store.set(key, value);
          return Promise.resolve();
        }),
      };
      const service = new ToolsetsService(
        configService,
        cacheManager as never,
        userConfigService as never,
      );
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
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
        .spyOn(service['client'], 'getToolSets')
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
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.listToolsets('u', 't', 'bucket')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.listToolsets('u', 't', 'bucket')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on upstream 429', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        errResponse(429),
      );
      await expect(service.listToolsets('u', 't', 'bucket')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        errResponse(500),
      );
      await expect(service.listToolsets('u', 't', 'bucket')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolSets').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.listToolsets('u', 't', 'bucket')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('redacts client_secret from list items', async () => {
      const { service } = makeService();
      const toolsetWithSecret: DialToolsetDto = {
        ...mockToolset,
        auth_settings: {
          authentication_type: 'OAUTH',
          client_id: 'id',
          client_secret: 'secret-value',
        } as DialToolsetDto['auth_settings'] & { client_secret: string },
      };
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        okResponse({ data: [toolsetWithSecret] }),
      );

      const result = await service.listToolsets('user1', 'token', 'bucket');
      expect(result.data[0].auth_settings).toEqual({
        authentication_type: 'OAUTH',
        client_id: 'id',
      });
      expect(
        (result.data[0].auth_settings as { client_secret?: string })
          .client_secret,
      ).toBeUndefined();
    });
  });

  describe('getToolset', () => {
    it('returns toolset from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        okResponse(mockToolset),
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
      const { configService, userConfigService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockToolset),
        set: vi.fn(),
      };
      const service = new ToolsetsService(
        configService,
        cacheManager as never,
        userConfigService as never,
      );
      const spy = vi
        .spyOn(service['client'], 'getToolset')
        .mockResolvedValue(okResponse(mockToolset));

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
      userConfigService.getInstalledIds.mockResolvedValue({
        toolsets: ['toolsets/bucket/my-toolset'],
        deployments: [],
      });
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        okResponse({
          ...mockToolset,
          id: 'toolsets/bucket/my-toolset',
          toolset: 'toolsets/bucket/my-toolset',
        }),
      );

      const result = await service.getToolset(
        'user1',
        'token-abc',
        'bucket',
        'toolsets/bucket/my-toolset',
      );
      expect(result).toMatchObject({
        id: 'toolsets/bucket/my-toolset',
        is_installed: true,
        is_my: true,
      });
    });

    it('uses per-user per-toolset cache key', async () => {
      const { service, cacheManager } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        okResponse(mockToolset),
      );

      await service.getToolset('user1', 'token', 'bucket', 'my-toolset');
      expect(cacheManager.get).toHaveBeenCalledWith(
        'toolsets:single:user1:my-toolset',
      );
    });

    it('forwards toolset name and Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['client'], 'getToolset')
        .mockResolvedValue(okResponse(mockToolset));

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
        ...mockToolset,
        auth_settings: {
          authentication_type: 'OAUTH',
          client_id: 'id',
          client_secret: 'secret-value',
        },
      };
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        okResponse(toolsetWithSecret),
      );

      const result = await service.getToolset(
        'user1',
        'token',
        'bucket',
        'my-toolset',
      );
      expect(
        (result.auth_settings as { client_secret?: string }).client_secret,
      ).toBeUndefined();
      expect(cacheManager.set).toHaveBeenCalledWith(
        'toolsets:single:user1:my-toolset',
        expect.objectContaining({
          auth_settings: expect.not.objectContaining({
            client_secret: expect.anything(),
          }),
        }),
        60 * 1000,
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        errResponse(404),
      );
      await expect(
        service.getToolset('u', 't', 'bucket', 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        errResponse(401),
      );
      await expect(
        service.getToolset('u', 't', 'bucket', 'my-toolset'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        errResponse(403),
      );
      await expect(
        service.getToolset('u', 't', 'bucket', 'my-toolset'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        errResponse(502),
      );
      await expect(
        service.getToolset('u', 't', 'bucket', 'my-toolset'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(
        service.getToolset('u', 't', 'bucket', 'my-toolset'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});

function makeWriteService() {
  const { configService, userConfigService } = makeDeps();
  const cacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  };
  const service = new ToolsetsService(
    configService,
    cacheManager as never,
    userConfigService as never,
  );
  return { service, cacheManager };
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
      vi.spyOn(service['client'], 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      vi.spyOn(service['client'], 'saveToolSet').mockResolvedValue(
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
      vi.spyOn(service['client'], 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['client'], 'saveToolSet')
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

    it('maps fields to DIAL Core snake_case in the PUT body', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['client'], 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['client'], 'saveToolSet')
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
        display_name: 'My toolset',
        display_version: '0.0.1',
        endpoint: 'https://my-toolset.example.com/mcp',
        transport: 'HTTP',
        allowed_tools: ['tool1'],
        description: 'desc',
        icon_url: 'https://example.com/icon.svg',
        description_keywords: ['a', 'b'],
        auth_settings: {
          authentication_type: 'API_KEY',
          api_key_header: 'X-Api-Key',
        },
      });
    });

    it('throws UnauthorizedException when the bucket call returns 401', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['client'], 'getUserBucket').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.createToolset('u', 't', baseBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not invalidate cache when the PUT returns an error', async () => {
      const { service, cacheManager } = makeWriteService();
      vi.spyOn(service['client'], 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      vi.spyOn(service['client'], 'saveToolSet').mockResolvedValue(
        errResponse(409),
      );
      await expect(
        service.createToolset('user1', 't', baseBody),
      ).rejects.toThrow();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['client'], 'getUserBucket').mockRejectedValue(
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
        .spyOn(service['client'], 'saveToolSet')
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
            display_name: 'My toolset',
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith('toolsets:list:user1');
      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['client'], 'saveToolSet').mockResolvedValue(
        errResponse(404),
      );
      await expect(
        service.updateToolset('u', 't', id, baseBody),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteToolset', () => {
    const id = 'toolsets/test-bucket/My%20toolset__0.0.1';

    it('DELETEs the toolset id path and invalidates caches', async () => {
      const { service, cacheManager } = makeWriteService();
      const deleteSpy = vi
        .spyOn(service['client'], 'deleteToolSet')
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
      vi.spyOn(service['client'], 'deleteToolSet').mockResolvedValue(
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
        .spyOn(service['client'], 'toolsetSignin')
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
      expect(sentBody.api_key).toBe('secret-key');
      expect(sentBody.code).toBeUndefined();
    });

    it('posts OAuth code + redirectUri to the signin endpoint', async () => {
      const { service } = makeWriteService();
      const signinSpy = vi
        .spyOn(service['client'], 'toolsetSignin')
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
      expect(sentBody.redirect_uri).toBe(
        'https://chat.example.com/toolset-editor/callback',
      );
      expect(sentBody.api_key).toBeUndefined();
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['client'], 'toolsetSignin').mockResolvedValue(
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
        .spyOn(service['client'], 'toolSetSignout')
        .mockResolvedValue(mutationSdkOk);

      await service.logoutToolset('user1', 'token', id, {
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
            authentication_type: ToolsetAuthType.OAuth,
            credentials_level: ToolsetCredentialsLevel.User,
            url: id,
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });
  });
});
