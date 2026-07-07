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
import type { CreateApplicationBodyDto } from '../dto/create-application.dto';

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
    del: vi.fn().mockResolvedValue(undefined),
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

  describe('createApplication', () => {
    const body: CreateApplicationBodyDto = {
      name: 'My App',
      type: 'https://mydial.epam.com/custom_application_schemas/quickapps2',
    };

    const bucketOk = {
      ok: true,
      json: () => Promise.resolve({ bucket: 'test-bucket' }),
    };
    const putOk = { ok: true };

    it('creates application, returns composite id, and invalidates cache', async () => {
      const { service, cacheManager } = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(bucketOk).mockResolvedValueOnce(putOk),
      );

      const result = await service.createApplication(
        'user1',
        'token-abc',
        body,
      );
      expect(result).toEqual({
        id: 'applications/test-bucket/My App__0.0.1',
      });
      expect(cacheManager.del).toHaveBeenCalledWith('applications:list:user1');
    });

    it('uses provided version in path and body', async () => {
      const { service } = makeService();
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(bucketOk)
        .mockResolvedValueOnce(putOk);
      vi.stubGlobal('fetch', fetchSpy);

      const result = await service.createApplication('user1', 't', {
        ...body,
        version: '2.0',
      });
      expect(result.id).toBe('applications/test-bucket/My App__2.0');
      const putUrl = fetchSpy.mock.calls[1][0] as string;
      expect(putUrl).toContain('My%20App__2.0');
    });

    it('defaults version to 0.0.1 when not provided', async () => {
      const { service } = makeService();
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(bucketOk)
        .mockResolvedValueOnce(putOk);
      vi.stubGlobal('fetch', fetchSpy);

      const result = await service.createApplication('user1', 't', body);
      expect(result.id).toContain('__0.0.1');
    });

    it('maps DTO fields to DIAL Core snake_case names in PUT body', async () => {
      const { service } = makeService();
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(bucketOk)
        .mockResolvedValueOnce(putOk);
      vi.stubGlobal('fetch', fetchSpy);

      await service.createApplication('user1', 'token', {
        name: 'My App',
        type: 'https://mydial.epam.com/custom_application_schemas/quickapps2',
        description: 'A description',
        iconUrl: 'https://example.com/icon.svg',
        version: '1.0',
      });

      const sentBody = JSON.parse(
        fetchSpy.mock.calls[1][1].body as string,
      ) as Record<string, unknown>;
      expect(sentBody).toEqual({
        display_name: 'My App',
        display_version: '1.0',
        application_type_schema_id:
          'https://mydial.epam.com/custom_application_schemas/quickapps2',
        application_properties: {},
        description: 'A description',
        icon_url: 'https://example.com/icon.svg',
      });
    });

    it('maps topics to description_keywords in PUT body', async () => {
      const { service } = makeService();
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(bucketOk)
        .mockResolvedValueOnce(putOk);
      vi.stubGlobal('fetch', fetchSpy);

      await service.createApplication('user1', 'token', {
        ...body,
        topics: ['nlp', 'assistant'],
      });

      const sentBody = JSON.parse(
        fetchSpy.mock.calls[1][1].body as string,
      ) as Record<string, unknown>;
      expect(sentBody).toMatchObject({
        description_keywords: ['nlp', 'assistant'],
      });
      expect(sentBody).not.toHaveProperty('topics');
    });

    it('forwards Authorization header to both bucket and PUT requests', async () => {
      const { service } = makeService();
      const fetchSpy = vi
        .fn()
        .mockResolvedValueOnce(bucketOk)
        .mockResolvedValueOnce(putOk);
      vi.stubGlobal('fetch', fetchSpy);

      await service.createApplication('user1', 'my-token', body);
      for (const call of fetchSpy.mock.calls) {
        expect(call[1]).toEqual(
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer my-token',
            }),
          }),
        );
      }
    });

    it('throws UnauthorizedException when bucket call returns 401', async () => {
      const { service } = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 401 }),
      );
      await expect(service.createApplication('u', 't', body)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException when PUT returns 403', async () => {
      const { service } = makeService();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(bucketOk)
          .mockResolvedValueOnce({
            ok: false,
            status: 403,
            text: () => Promise.resolve(''),
          }),
      );
      await expect(service.createApplication('u', 't', body)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) when PUT returns 429', async () => {
      const { service } = makeService();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(bucketOk)
          .mockResolvedValueOnce({
            ok: false,
            status: 429,
            text: () => Promise.resolve(''),
          }),
      );
      await expect(service.createApplication('u', 't', body)).rejects.toThrow(
        HttpException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      );
      await expect(service.createApplication('u', 't', body)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('does not invalidate cache when PUT returns error', async () => {
      const { service, cacheManager } = makeService();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(bucketOk)
          .mockResolvedValueOnce({
            ok: false,
            status: 409,
            text: () => Promise.resolve(''),
          }),
      );
      await expect(
        service.createApplication('user1', 't', body),
      ).rejects.toThrow();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });
});
