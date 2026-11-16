import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DialClientService } from '../../dial/dial-client.service';
import type {
  DialModelDto,
  DialModelListResponseDto,
} from '../../openapi/openapi-response.dto';
import { ModelsService } from '../models.service';

const mockModel: DialModelDto = {
  id: 'gpt-4o',
  object: 'model',
};
const mockList: DialModelListResponseDto = { data: [mockModel] };

const okResponse = (data: unknown) =>
  ({ data, response: { ok: true, status: 200 } as Response }) as never;

const errResponse = (status: number) =>
  ({
    error: {},
    response: { ok: false, status } as Response,
  }) as never;

/*
 * Mirrors openapi-fetch's real behavior for a non-2xx response with an empty
 * body (e.g. DIAL Core's 404 for an unknown model has Content-Length: 0):
 * it returns `{ error: undefined, response }`, never populating `error`.
 * Regression coverage for [#7926](https://github.com/epam/ai-dial-chat/issues/7926).
 */
const emptyBodyErrResponse = (status: number) =>
  ({
    error: undefined,
    data: undefined,
    response: { ok: false, status } as Response,
  }) as never;

const makeConfig = (hiddenTags: string[] = []) =>
  ({
    get: vi.fn((key: string) =>
      key === 'HIDDEN_ENTITY_TAGS' ? hiddenTags : undefined,
    ),
  }) as unknown as ConfigService<EnvironmentVariables>;

function makeDeps() {
  const dialClient = {
    client: { getModels: vi.fn(), getModel: vi.fn() },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const cacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  };

  return { dialClient, cacheManager };
}

function makeService(hiddenTags: string[] = []) {
  const { dialClient, cacheManager } = makeDeps();
  const service = new ModelsService(
    dialClient,
    makeConfig(hiddenTags),
    cacheManager as never,
  );
  return { service, cacheManager };
}

/* A cache that really stores, so a test can prove the second call is a hit. */
const makeMemoryCache = () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
};

const hiddenModel: DialModelDto = {
  id: 'gpt-4o',
  object: 'model',
  description_keywords: ['HIDDEN', 'Text'],
};
const visibleModel: DialModelDto = {
  id: 'claude-opus',
  object: 'model',
  description_keywords: ['Text'],
};

describe('ModelsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listModels', () => {
    it('returns list from upstream on cache miss', async () => {
      const { service } = makeService();
      const upstreamList = { ...mockList, object: 'list' };
      vi.spyOn(service['dialClient'].client, 'getModels').mockResolvedValue(
        okResponse(upstreamList),
      );

      const result = await service.listModels('user1', 'token-abc');
      expect(result).toEqual(mockList);
    });

    it('returns cached list without calling upstream on cache hit', async () => {
      const { dialClient } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockList),
        set: vi.fn(),
      };
      const service = new ModelsService(
        dialClient,
        makeConfig(),
        cacheManager as never,
      );
      const spy = vi
        .spyOn(service['dialClient'].client, 'getModels')
        .mockResolvedValue(okResponse(mockList));

      const result = await service.listModels('user1', 'token-abc');
      expect(result).toEqual(mockList);
      expect(spy).not.toHaveBeenCalled();
    });

    it('uses per-user cache keys — different users get different cache entries', async () => {
      const { dialClient } = makeDeps();
      const store = new Map<string, unknown>();
      const cacheManager = {
        get: vi.fn((key: string) => Promise.resolve(store.get(key))),
        set: vi.fn((key: string, value: unknown) => {
          store.set(key, value);
          return Promise.resolve();
        }),
      };
      const service = new ModelsService(
        dialClient,
        makeConfig(),
        cacheManager as never,
      );
      vi.spyOn(service['dialClient'].client, 'getModels').mockResolvedValue(
        okResponse(mockList),
      );

      await service.listModels('user1', 'token1');
      await service.listModels('user2', 'token2');

      expect(cacheManager.get).toHaveBeenCalledWith('models:list:user1');
      expect(cacheManager.get).toHaveBeenCalledWith('models:list:user2');
    });

    it('forwards Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getModels')
        .mockResolvedValue(okResponse(mockList));

      await service.listModels('user1', 'my-token');
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
      vi.spyOn(service['dialClient'].client, 'getModels').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.listModels('u', 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModels').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.listModels('u', 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on upstream 429', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModels').mockResolvedValue(
        errResponse(429),
      );
      await expect(service.listModels('u', 't')).rejects.toThrow(HttpException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModels').mockResolvedValue(
        errResponse(500),
      );
      await expect(service.listModels('u', 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws BadGatewayException on upstream 5xx with an empty body', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModels').mockResolvedValue(
        emptyBodyErrResponse(500),
      );
      await expect(service.listModels('u', 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModels').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.listModels('u', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getModel', () => {
    it('returns model from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        okResponse(mockModel),
      );

      const result = await service.getModel('user1', 'token-abc', 'gpt-4o');
      expect(result).toEqual(mockModel);
    });

    it('returns cached model without calling upstream on cache hit', async () => {
      const { dialClient } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockModel),
        set: vi.fn(),
      };
      const service = new ModelsService(
        dialClient,
        makeConfig(),
        cacheManager as never,
      );
      const spy = vi
        .spyOn(service['dialClient'].client, 'getModel')
        .mockResolvedValue(okResponse(mockModel));

      const result = await service.getModel('user1', 'token-abc', 'gpt-4o');
      expect(result).toEqual(mockModel);
      expect(spy).not.toHaveBeenCalled();
    });

    it('uses per-user per-model cache key', async () => {
      const { service, cacheManager } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        okResponse(mockModel),
      );

      await service.getModel('user1', 'token', 'gpt-4o');
      expect(cacheManager.get).toHaveBeenCalledWith(
        'models:single:user1:gpt-4o',
      );
    });

    it('forwards model name and Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getModel')
        .mockResolvedValue(okResponse(mockModel));

      await service.getModel('user1', 'my-token', 'gpt-4o');
      expect(spy).toHaveBeenCalledWith(
        'gpt-4o',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        errResponse(404),
      );
      await expect(service.getModel('u', 't', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException on upstream 404 with an empty body', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        emptyBodyErrResponse(404),
      );
      await expect(service.getModel('u', 't', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.getModel('u', 't', 'gpt-4o')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.getModel('u', 't', 'gpt-4o')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        errResponse(502),
      );
      await expect(service.getModel('u', 't', 'gpt-4o')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModel').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.getModel('u', 't', 'gpt-4o')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('HIDDEN_ENTITY_TAGS', () => {
    it('omits hidden models from the list', async () => {
      const { service } = makeService(['HIDDEN']);
      vi.spyOn(service['dialClient'].client, 'getModels').mockResolvedValue(
        okResponse({ data: [hiddenModel, visibleModel] }),
      );

      const result = await service.listModels('user1', 'token');

      expect(result).toEqual({ data: [visibleModel] });
    });

    it('caches the filtered list so a repeated call skips upstream', async () => {
      const { dialClient } = makeDeps();
      const cacheManager = makeMemoryCache();
      const service = new ModelsService(
        dialClient,
        makeConfig(['HIDDEN']),
        cacheManager as never,
      );
      const spy = vi
        .spyOn(service['dialClient'].client, 'getModels')
        .mockResolvedValue(okResponse({ data: [hiddenModel, visibleModel] }));

      const first = await service.listModels('user1', 'token');
      const second = await service.listModels('user1', 'token');

      expect(spy).toHaveBeenCalledOnce();
      expect(cacheManager.set).toHaveBeenCalledWith(
        'models:list:user1',
        { data: [visibleModel] },
        30_000,
      );
      expect(first).toEqual({ data: [visibleModel] });
      expect(second).toEqual({ data: [visibleModel] });
    });

    it('returns every model when no tag is configured', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModels').mockResolvedValue(
        okResponse({ data: [hiddenModel, visibleModel] }),
      );

      const result = await service.listModels('user1', 'token');

      expect(result).toEqual({ data: [hiddenModel, visibleModel] });
    });

    it('answers NotFoundException for a hidden model lookup', async () => {
      const { service } = makeService(['HIDDEN']);
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        okResponse(hiddenModel),
      );

      await expect(
        service.getModel('user1', 'token', 'gpt-4o'),
      ).rejects.toThrow(new NotFoundException('Resource not found'));
    });

    it('serves a repeated hidden lookup from the cache', async () => {
      const { dialClient } = makeDeps();
      const service = new ModelsService(
        dialClient,
        makeConfig(['HIDDEN']),
        makeMemoryCache() as never,
      );
      const spy = vi
        .spyOn(service['dialClient'].client, 'getModel')
        .mockResolvedValue(okResponse(hiddenModel));

      await expect(
        service.getModel('user1', 'token', 'gpt-4o'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getModel('user1', 'token', 'gpt-4o'),
      ).rejects.toThrow(NotFoundException);
      expect(spy).toHaveBeenCalledOnce();
    });

    it('returns a model without a hidden tag', async () => {
      const { service } = makeService(['HIDDEN']);
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        okResponse(visibleModel),
      );

      const result = await service.getModel('user1', 'token', 'claude-opus');

      expect(result).toEqual(visibleModel);
    });

    it('returns a tagged model when no tag is configured', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        okResponse(hiddenModel),
      );

      const result = await service.getModel('user1', 'token', 'gpt-4o');

      expect(result).toEqual(hiddenModel);
    });

    it('keeps mapping an upstream 403 to ForbiddenException', async () => {
      const { service } = makeService(['HIDDEN']);
      vi.spyOn(service['dialClient'].client, 'getModel').mockResolvedValue(
        errResponse(403),
      );

      await expect(
        service.getModel('user1', 'token', 'gpt-4o'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
