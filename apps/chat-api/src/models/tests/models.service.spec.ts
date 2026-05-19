import type { DialModel, DialModelListResponse } from '@epam/chat-shared';
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
import { ModelsService } from '../models.service';

const mockModel: DialModel = {
  id: 'gpt-4o',
  object: 'model',
  owned_by: 'openai',
};
const mockList: DialModelListResponse = { data: [mockModel] };

function makeDeps() {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'DIAL_CORE_TIMEOUT_MS') return 5000;
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
  const service = new ModelsService(configService, cacheManager as never);
  return { service, cacheManager };
}

function mockFetchOk(body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

function mockFetchStatus(status: number) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: false,
    status,
  } as unknown as Response);
}

describe('ModelsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listModels', () => {
    it('returns list from upstream on cache miss', async () => {
      const { service } = makeService();
      mockFetchOk(mockList);

      const result = await service.listModels('user1', 'token-abc');
      expect(result).toEqual(mockList);
    });

    it('returns cached list without calling upstream on cache hit', async () => {
      const { configService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockList),
        set: vi.fn(),
      };
      const service = new ModelsService(configService, cacheManager as never);
      const spy = mockFetchOk(mockList);

      const result = await service.listModels('user1', 'token-abc');
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
      const service = new ModelsService(configService, cacheManager as never);
      mockFetchOk(mockList);

      await service.listModels('user1', 'token1');
      await service.listModels('user2', 'token2');

      expect(cacheManager.get).toHaveBeenCalledWith('models:list:user1');
      expect(cacheManager.get).toHaveBeenCalledWith('models:list:user2');
    });

    it('forwards Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = mockFetchOk(mockList);

      await service.listModels('user1', 'my-token');
      expect(spy).toHaveBeenCalledWith(
        'http://dial-core/openai/models',
        expect.objectContaining({
          headers: { Authorization: 'Bearer my-token' },
        }),
      );
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      mockFetchStatus(401);
      await expect(service.listModels('u', 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      mockFetchStatus(403);
      await expect(service.listModels('u', 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on upstream 429', async () => {
      const { service } = makeService();
      mockFetchStatus(429);
      await expect(service.listModels('u', 't')).rejects.toThrow(HttpException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      mockFetchStatus(500);
      await expect(service.listModels('u', 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on timeout', async () => {
      const { service } = makeService();
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        () =>
          new Promise((_, reject) => {
            const err = new Error('The operation was aborted');
            (err as NodeJS.ErrnoException).name = 'AbortError';
            reject(err);
          }),
      );
      await expect(service.listModels('u', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getModel', () => {
    it('returns model from upstream on cache miss', async () => {
      const { service } = makeService();
      mockFetchOk(mockModel);

      const result = await service.getModel('user1', 'token-abc', 'gpt-4o');
      expect(result).toEqual(mockModel);
    });

    it('returns cached model without calling upstream on cache hit', async () => {
      const { configService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockModel),
        set: vi.fn(),
      };
      const service = new ModelsService(configService, cacheManager as never);
      const spy = mockFetchOk(mockModel);

      const result = await service.getModel('user1', 'token-abc', 'gpt-4o');
      expect(result).toEqual(mockModel);
      expect(spy).not.toHaveBeenCalled();
    });

    it('uses per-user per-model cache key', async () => {
      const { service, cacheManager } = makeService();
      mockFetchOk(mockModel);

      await service.getModel('user1', 'token', 'gpt-4o');
      expect(cacheManager.get).toHaveBeenCalledWith(
        'models:single:user1:gpt-4o',
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      mockFetchStatus(404);
      await expect(service.getModel('u', 't', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      mockFetchStatus(401);
      await expect(service.getModel('u', 't', 'gpt-4o')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      mockFetchStatus(403);
      await expect(service.getModel('u', 't', 'gpt-4o')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      mockFetchStatus(502);
      await expect(service.getModel('u', 't', 'gpt-4o')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on timeout', async () => {
      const { service } = makeService();
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        () =>
          new Promise((_, reject) => {
            const err = new Error('The operation was aborted');
            (err as NodeJS.ErrnoException).name = 'AbortError';
            reject(err);
          }),
      );
      await expect(service.getModel('u', 't', 'gpt-4o')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
