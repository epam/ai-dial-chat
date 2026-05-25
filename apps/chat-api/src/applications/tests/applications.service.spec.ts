import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { ApplicationsService } from '../applications.service';
import type { ApplicationsResponseDto } from '../dto/application.dto';

const mockApp = { id: 'my-app', object: 'application', display_name: 'My App' };
const mockList: ApplicationsResponseDto = { data: [mockApp] };

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
  const service = new ApplicationsService(configService, cacheManager as never);
  return { service, cacheManager };
}

describe('ApplicationsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listApplications', () => {
    it('returns list from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getApplications').mockResolvedValue(
        okResponse({ data: [mockApp] }),
      );

      const result = await service.listApplications('user1', 'token-abc');
      expect(result).toEqual(mockList);
    });

    it('returns empty list when upstream data is missing', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getApplications').mockResolvedValue(
        okResponse({}),
      );

      const result = await service.listApplications('user1', 'token-abc');
      expect(result).toEqual({ data: [] });
    });

    it('returns cached list without calling upstream on cache hit', async () => {
      const { configService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockList),
        set: vi.fn(),
      };
      const service = new ApplicationsService(
        configService,
        cacheManager as never,
      );
      const spy = vi
        .spyOn(service['client'], 'getApplications')
        .mockResolvedValue(okResponse({ data: [mockApp] }));

      const result = await service.listApplications('user1', 'token-abc');
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
      const service = new ApplicationsService(
        configService,
        cacheManager as never,
      );
      vi.spyOn(service['client'], 'getApplications').mockResolvedValue(
        okResponse({ data: [mockApp] }),
      );

      await service.listApplications('user1', 'token1');
      await service.listApplications('user2', 'token2');

      expect(cacheManager.get).toHaveBeenCalledWith('applications:list:user1');
      expect(cacheManager.get).toHaveBeenCalledWith('applications:list:user2');
    });

    it('forwards Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['client'], 'getApplications')
        .mockResolvedValue(okResponse({ data: [mockApp] }));

      await service.listApplications('user1', 'my-token');
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
      vi.spyOn(service['client'], 'getApplications').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getApplications').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on upstream 429', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getApplications').mockResolvedValue(
        errResponse(429),
      );
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getApplications').mockResolvedValue(
        errResponse(500),
      );
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getApplications').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
