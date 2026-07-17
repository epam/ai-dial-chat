import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentsService } from '../../deployments/deployments.service';
import type { DialClientService } from '../../dial/dial-client.service';
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
  const dialClient = {
    client: {
      getApplications: vi.fn(),
      getUserBucket: vi.fn(),
      saveCustomApplication: vi.fn(),
      deleteCustomApplication: vi.fn(),
    },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const cacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  };

  const deploymentsService = {
    invalidateListCache: vi.fn().mockResolvedValue(undefined),
  } as unknown as DeploymentsService;

  return { dialClient, cacheManager, deploymentsService };
}

function makeService() {
  const { dialClient, cacheManager, deploymentsService } = makeDeps();
  const service = new ApplicationsService(
    dialClient,
    cacheManager as never,
    deploymentsService,
  );
  return { service, cacheManager, deploymentsService };
}

describe('ApplicationsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listApplications', () => {
    it('returns list from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getApplications',
      ).mockResolvedValue(okResponse({ data: [mockApp] }));

      const result = await service.listApplications('user1', 'token-abc');
      expect(result).toEqual(mockList);
    });

    it('returns empty list when upstream data is missing', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getApplications',
      ).mockResolvedValue(okResponse({}));

      const result = await service.listApplications('user1', 'token-abc');
      expect(result).toEqual({ data: [] });
    });

    it('returns cached list without calling upstream on cache hit', async () => {
      const { dialClient, deploymentsService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockList),
        set: vi.fn(),
      };
      const service = new ApplicationsService(
        dialClient,
        cacheManager as never,
        deploymentsService,
      );
      const spy = vi
        .spyOn(service['dialClient'].client, 'getApplications')
        .mockResolvedValue(okResponse({ data: [mockApp] }));

      const result = await service.listApplications('user1', 'token-abc');
      expect(result).toEqual(mockList);
      expect(spy).not.toHaveBeenCalled();
    });

    it('uses per-user cache keys — different users get different cache entries', async () => {
      const { dialClient, deploymentsService } = makeDeps();
      const store = new Map<string, unknown>();
      const cacheManager = {
        get: vi.fn((key: string) => Promise.resolve(store.get(key))),
        set: vi.fn((key: string, value: unknown) => {
          store.set(key, value);
          return Promise.resolve();
        }),
      };
      const service = new ApplicationsService(
        dialClient,
        cacheManager as never,
        deploymentsService,
      );
      vi.spyOn(
        service['dialClient'].client,
        'getApplications',
      ).mockResolvedValue(okResponse({ data: [mockApp] }));

      await service.listApplications('user1', 'token1');
      await service.listApplications('user2', 'token2');

      expect(cacheManager.get).toHaveBeenCalledWith('applications:list:user1');
      expect(cacheManager.get).toHaveBeenCalledWith('applications:list:user2');
    });

    it('forwards Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getApplications')
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
      vi.spyOn(
        service['dialClient'].client,
        'getApplications',
      ).mockResolvedValue(errResponse(401));
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getApplications',
      ).mockResolvedValue(errResponse(403));
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on upstream 429', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getApplications',
      ).mockResolvedValue(errResponse(429));
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getApplications',
      ).mockResolvedValue(errResponse(500));
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getApplications',
      ).mockRejectedValue(new TypeError('fetch failed'));
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

    const mockCreateApplicationSdk = (
      service: ApplicationsService,
      bucketResponse = okResponse({ bucket: 'test-bucket' }),
      saveResponse = okResponse({}),
    ) => {
      const getUserBucketSpy = vi
        .spyOn(service['dialClient'].client, 'getUserBucket')
        .mockResolvedValue(bucketResponse);
      const saveCustomApplicationSpy = vi
        .spyOn(service['dialClient'].client, 'saveCustomApplication')
        .mockResolvedValue(saveResponse);

      return { getUserBucketSpy, saveCustomApplicationSpy };
    };

    it('creates application, returns composite id, and invalidates cache', async () => {
      const { service, cacheManager } = makeService();
      mockCreateApplicationSdk(service);

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
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      const result = await service.createApplication('user1', 't', {
        ...body,
        version: '2.0',
      });
      expect(result.id).toBe('applications/test-bucket/My App__2.0');
      expect(saveCustomApplicationSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('My%20App__2.0'),
        expect.objectContaining({
          body: expect.objectContaining({ displayVersion: '2.0' }),
        }),
      );
    });

    it('defaults version to 0.0.1 when not provided', async () => {
      const { service } = makeService();
      mockCreateApplicationSdk(service);

      const result = await service.createApplication('user1', 't', body);
      expect(result.id).toContain('__0.0.1');
    });

    it('maps DTO fields to DIAL Core SDK application body', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', {
        name: 'My App',
        type: 'https://mydial.epam.com/custom_application_schemas/quickapps2',
        description: 'A description',
        iconUrl: 'https://example.com/icon.svg',
        version: '1.0',
      });

      expect(saveCustomApplicationSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          body: {
            displayName: 'My App',
            displayVersion: '1.0',
            application_type_schema_id:
              'https://mydial.epam.com/custom_application_schemas/quickapps2',
            application_properties: {},
            description: 'A description',
            iconUrl: 'https://example.com/icon.svg',
          },
        }),
      );
    });

    it('maps topics to descriptionKeywords in SDK body', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', {
        ...body,
        topics: ['nlp', 'assistant'],
      });

      expect(saveCustomApplicationSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          body: expect.objectContaining({
            descriptionKeywords: ['nlp', 'assistant'],
          }),
        }),
      );
      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).not.toHaveProperty('topics');
    });

    it('maps intro to the top-level intro field in SDK body', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', {
        ...body,
        intro: 'A short pitch',
      });

      expect(saveCustomApplicationSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          body: expect.objectContaining({
            intro: 'A short pitch',
          }),
        }),
      );
    });

    it('does not set intro when it is omitted', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', body);

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).not.toHaveProperty('intro');
    });

    it('forwards Authorization header to bucket and save application SDK calls', async () => {
      const { service } = makeService();
      const { getUserBucketSpy, saveCustomApplicationSpy } =
        mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'my-token', body);
      expect(getUserBucketSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
      expect(saveCustomApplicationSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('throws UnauthorizedException when bucket call returns 401', async () => {
      const { service } = makeService();
      mockCreateApplicationSdk(service, errResponse(401));
      await expect(service.createApplication('u', 't', body)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadGatewayException when bucket call returns an empty body', async () => {
      const { service } = makeService();
      mockCreateApplicationSdk(service, okResponse(null));
      await expect(service.createApplication('u', 't', body)).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ForbiddenException when PUT returns 403', async () => {
      const { service } = makeService();
      mockCreateApplicationSdk(service, undefined, errResponse(403));
      await expect(service.createApplication('u', 't', body)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) when PUT returns 429', async () => {
      const { service } = makeService();
      mockCreateApplicationSdk(service, undefined, errResponse(429));
      await expect(service.createApplication('u', 't', body)).rejects.toThrow(
        HttpException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.createApplication('u', 't', body)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('does not invalidate cache when PUT returns error', async () => {
      const { service, cacheManager } = makeService();
      mockCreateApplicationSdk(service, undefined, errResponse(409));
      await expect(
        service.createApplication('user1', 't', body),
      ).rejects.toThrow();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  describe('deleteApplication', () => {
    const id = 'applications/test-bucket/My%20App__0.0.1';

    it('DELETEs the application id path and invalidates cache', async () => {
      const { service, cacheManager } = makeService();
      const deleteSpy = vi
        .spyOn(service['dialClient'].client, 'deleteCustomApplication')
        .mockResolvedValue(okResponse({}));

      await service.deleteApplication('user1', 'token', id);
      expect(deleteSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20App__0.0.1',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith('applications:list:user1');
    });

    it('invalidates the deployments list cache on successful delete', async () => {
      const { service, deploymentsService } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'deleteCustomApplication',
      ).mockResolvedValue(okResponse({}));

      await service.deleteApplication('user1', 'token', id);
      expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith(
        'user1',
      );
    });

    it('does not invalidate the deployments list cache when delete returns error', async () => {
      const { service, deploymentsService } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'deleteCustomApplication',
      ).mockResolvedValue(errResponse(409));

      await expect(
        service.deleteApplication('user1', 't', id),
      ).rejects.toThrow();
      expect(deploymentsService.invalidateListCache).not.toHaveBeenCalled();
    });

    it('resolves bucket via getUserBucket when applicationName has no bucket prefix', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        okResponse({ bucket: 'my-bucket' }),
      );
      const deleteSpy = vi
        .spyOn(service['dialClient'].client, 'deleteCustomApplication')
        .mockResolvedValue(okResponse({}));

      await service.deleteApplication('user1', 'token', 'my-app__1.0');
      expect(deleteSpy).toHaveBeenCalledWith(
        'my-bucket',
        'my-app__1.0',
        expect.anything(),
      );
    });

    it('throws ForbiddenException when delete returns 403', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'deleteCustomApplication',
      ).mockResolvedValue(errResponse(403));
      await expect(service.deleteApplication('u', 't', id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'deleteCustomApplication',
      ).mockRejectedValue(new TypeError('fetch failed'));
      await expect(service.deleteApplication('u', 't', id)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('does not invalidate cache when delete returns error', async () => {
      const { service, cacheManager } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'deleteCustomApplication',
      ).mockResolvedValue(errResponse(409));
      await expect(
        service.deleteApplication('user1', 't', id),
      ).rejects.toThrow();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });
});
