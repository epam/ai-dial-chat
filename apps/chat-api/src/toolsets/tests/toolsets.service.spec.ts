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

  return { configService, cacheManager };
}

function makeService() {
  const { configService, cacheManager } = makeDeps();
  const service = new ToolsetsService(configService, cacheManager as never);
  return { service, cacheManager };
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

      const result = await service.listToolsets('user1', 'token-abc');
      expect(result).toEqual(mockList);
    });

    it('returns cached list without calling upstream on cache hit', async () => {
      const { configService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockList),
        set: vi.fn(),
      };
      const service = new ToolsetsService(configService, cacheManager as never);
      const spy = vi
        .spyOn(service['client'], 'getToolSets')
        .mockResolvedValue(okResponse(mockList));

      const result = await service.listToolsets('user1', 'token-abc');
      expect(result).toEqual(mockList);
      expect(spy).not.toHaveBeenCalled();
    });

    it('uses per-user cache keys — different users get different cache entries', async () => {
      const { configService } = makeDeps();
      const store = new Map<string, unknown>();
      const cacheManager = {
        get: vi.fn((key: string) => Promise.resolve(store.get(key))),
        set: vi.fn((key: string, value: unknown) => {
          store.set(key, value);
          return Promise.resolve();
        }),
      };
      const service = new ToolsetsService(configService, cacheManager as never);
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        okResponse(mockList),
      );

      await service.listToolsets('user1', 'token1');
      await service.listToolsets('user2', 'token2');

      expect(cacheManager.get).toHaveBeenCalledWith('toolsets:list:user1');
      expect(cacheManager.get).toHaveBeenCalledWith('toolsets:list:user2');
    });

    it('forwards Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['client'], 'getToolSets')
        .mockResolvedValue(okResponse(mockList));

      await service.listToolsets('user1', 'my-token');
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
      await expect(service.listToolsets('u', 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.listToolsets('u', 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on upstream 429', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        errResponse(429),
      );
      await expect(service.listToolsets('u', 't')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolSets').mockResolvedValue(
        errResponse(500),
      );
      await expect(service.listToolsets('u', 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolSets').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.listToolsets('u', 't')).rejects.toThrow(
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

      const result = await service.listToolsets('user1', 'token');
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
        'my-toolset',
      );
      expect(result).toEqual(mockToolset);
    });

    it('returns cached toolset without calling upstream on cache hit', async () => {
      const { configService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockToolset),
        set: vi.fn(),
      };
      const service = new ToolsetsService(configService, cacheManager as never);
      const spy = vi
        .spyOn(service['client'], 'getToolset')
        .mockResolvedValue(okResponse(mockToolset));

      const result = await service.getToolset(
        'user1',
        'token-abc',
        'my-toolset',
      );
      expect(result).toEqual(mockToolset);
      expect(spy).not.toHaveBeenCalled();
    });

    it('uses per-user per-toolset cache key', async () => {
      const { service, cacheManager } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        okResponse(mockToolset),
      );

      await service.getToolset('user1', 'token', 'my-toolset');
      expect(cacheManager.get).toHaveBeenCalledWith(
        'toolsets:single:user1:my-toolset',
      );
    });

    it('forwards toolset name and Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['client'], 'getToolset')
        .mockResolvedValue(okResponse(mockToolset));

      await service.getToolset('user1', 'my-token', 'my-toolset');
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

      const result = await service.getToolset('user1', 'token', 'my-toolset');
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
      await expect(service.getToolset('u', 't', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.getToolset('u', 't', 'my-toolset')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.getToolset('u', 't', 'my-toolset')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockResolvedValue(
        errResponse(502),
      );
      await expect(service.getToolset('u', 't', 'my-toolset')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getToolset').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.getToolset('u', 't', 'my-toolset')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
