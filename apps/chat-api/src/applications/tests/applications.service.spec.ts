import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentsService } from '../../deployments/deployments.service';
import { DeploymentsDetailsService } from '../../deployments/details/deployments-details.service';
import type { DialClientService } from '../../dial/dial-client.service';
import { ApplicationsService } from '../applications.service';
import type { ApplicationsResponseDto } from '../dto/application.dto';
import type { CreateApplicationBodyDto } from '../dto/create-application.dto';
import type { UpdateApplicationBodyDto } from '../dto/update-application.dto';

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
      getCustomApplication: vi.fn(),
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

  const deploymentsDetailsService = {
    invalidateDetailsCache: vi.fn().mockResolvedValue(undefined),
  } as unknown as DeploymentsDetailsService;

  return {
    dialClient,
    cacheManager,
    deploymentsService,
    deploymentsDetailsService,
  };
}

function makeService() {
  const {
    dialClient,
    cacheManager,
    deploymentsService,
    deploymentsDetailsService,
  } = makeDeps();
  const service = new ApplicationsService(
    dialClient,
    cacheManager as never,
    deploymentsService,
    deploymentsDetailsService,
  );
  return {
    service,
    cacheManager,
    deploymentsService,
    deploymentsDetailsService,
  };
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
      const { dialClient, deploymentsService, deploymentsDetailsService } =
        makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockList),
        set: vi.fn(),
      };
      const service = new ApplicationsService(
        dialClient,
        cacheManager as never,
        deploymentsService,
        deploymentsDetailsService,
      );
      const spy = vi
        .spyOn(service['dialClient'].client, 'getApplications')
        .mockResolvedValue(okResponse({ data: [mockApp] }));

      const result = await service.listApplications('user1', 'token-abc');
      expect(result).toEqual(mockList);
      expect(spy).not.toHaveBeenCalled();
    });

    it('uses per-user cache keys — different users get different cache entries', async () => {
      const { dialClient, deploymentsService, deploymentsDetailsService } =
        makeDeps();
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
        deploymentsDetailsService,
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
        id: 'applications/test-bucket/My%20App__0.0.1',
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
      expect(result.id).toBe('applications/test-bucket/My%20App__2.0');
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
            description: 'A description',
            iconUrl: 'https://example.com/icon.svg',
          },
        }),
      );
    });

    it('composes displayName/description as locale maps when locales is provided', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', {
        ...body,
        description: 'A description',
        locales: [
          {
            language: 'de',
            name: 'Meine App',
            description: 'Eine Beschreibung',
          },
        ],
        primaryLocale: 'en',
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({
        displayName: { en: 'My App', de: 'Meine App' },
        description: { en: 'A description', de: 'Eine Beschreibung' },
      });
    });

    it('still produces a plain-string displayName when locales is omitted (regression guard)', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', body);

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({ displayName: 'My App' });
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

  describe('updateApplication', () => {
    const id = 'applications/test-bucket/My%20App__0.0.1';
    const updateBody: UpdateApplicationBodyDto = { name: 'Updated App' };
    const existingApp = {
      displayName: 'My App',
      displayVersion: '0.0.1',
      application_type_schema_id: 'https://mydial.epam.com/schema',
      application_properties: {
        orchestrator: { system_prompt: { type: 'custom' } },
        tool_sets: ['toolset-1'],
      },
      description: 'Old description',
    };

    const mockUpdateApplicationSdk = (
      service: ApplicationsService,
      getResponse = okResponse(existingApp),
      saveResponse = okResponse({}),
    ) => {
      const getCustomApplicationSpy = vi
        .spyOn(service['dialClient'].client, 'getCustomApplication')
        .mockResolvedValue(getResponse);
      const saveCustomApplicationSpy = vi
        .spyOn(service['dialClient'].client, 'saveCustomApplication')
        .mockResolvedValue(saveResponse);

      return { getCustomApplicationSpy, saveCustomApplicationSpy };
    };

    it('merges General-step fields, persists at the same path, and invalidates caches', async () => {
      const {
        service,
        cacheManager,
        deploymentsService,
        deploymentsDetailsService,
      } = makeService();
      const { getCustomApplicationSpy, saveCustomApplicationSpy } =
        mockUpdateApplicationSdk(service);

      const result = await service.updateApplication('user1', 'token', id, {
        name: 'Updated App',
        description: 'New description',
        iconUrl: 'https://example.com/icon.svg',
        topics: ['nlp'],
      });

      expect(getCustomApplicationSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20App__0.0.1',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
      expect(saveCustomApplicationSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20App__0.0.1',
        expect.objectContaining({
          body: {
            displayName: 'Updated App',
            displayVersion: '0.0.1',
            application_type_schema_id: 'https://mydial.epam.com/schema',
            application_properties: existingApp.application_properties,
            description: 'New description',
            iconUrl: 'https://example.com/icon.svg',
            descriptionKeywords: ['nlp'],
          },
        }),
      );
      expect(result).toEqual({ id });
      expect(cacheManager.del).toHaveBeenCalledWith('applications:list:user1');
      expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith(
        'user1',
      );
      expect(
        deploymentsDetailsService.invalidateDetailsCache,
      ).toHaveBeenCalledWith('user1', id);
    });

    it('preserves application_properties, application_type_schema_id, and displayVersion when omitted from the body', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);

      await service.updateApplication('user1', 'token', id, updateBody);

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({
        application_properties: existingApp.application_properties,
        application_type_schema_id: existingApp.application_type_schema_id,
        displayVersion: existingApp.displayVersion,
      });
    });

    it('preserves application_properties when applicationProperties is explicitly null', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);

      await service.updateApplication('user1', 'token', id, {
        ...updateBody,
        applicationProperties: null,
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({
        application_properties: existingApp.application_properties,
      });
    });

    it('fully replaces application_properties when applicationProperties is supplied', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);
      const newProperties = {
        orchestrator: { system_prompt: { type: 'custom', content: 'v2' } },
        contexts: [],
        tool_sets: [],
        skills: ['weather'],
      };

      await service.updateApplication('user1', 'token', id, {
        ...updateBody,
        applicationProperties: newProperties,
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({
        application_properties: newProperties,
        application_type_schema_id: existingApp.application_type_schema_id,
        displayVersion: existingApp.displayVersion,
      });
    });

    it('preserves empty arrays inside applicationProperties as a deliberate clear', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);

      await service.updateApplication('user1', 'token', id, {
        ...updateBody,
        applicationProperties: { tool_sets: [] },
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({
        application_properties: { tool_sets: [] },
      });
    });

    it("does NOT hoist endpoint/features/inputAttachmentTypes/maxInputAttachments out of applicationProperties (regression: this used to strip a Quick App's own features key)", async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);

      await service.updateApplication('user1', 'token', id, {
        ...updateBody,
        applicationProperties: {
          endpoint: 'https://x.example/chat',
          features: { timestamp: true },
          inputAttachmentTypes: ['image/png'],
          maxInputAttachments: 3,
          tool_sets: [],
        },
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({
        application_properties: {
          endpoint: 'https://x.example/chat',
          features: { timestamp: true },
          inputAttachmentTypes: ['image/png'],
          maxInputAttachments: 3,
          tool_sets: [],
        },
      });
      // None of the four keys were lifted to the top level of the DIAL Core body.
      expect(sentBody).not.toHaveProperty('endpoint');
      expect(sentBody).not.toHaveProperty('features');
      expect(sentBody).not.toHaveProperty('inputAttachmentTypes');
      expect(sentBody).not.toHaveProperty('maxInputAttachments');
    });

    it('a top-level field and the same-named key inside applicationProperties are independent (no hoist/precedence to reconcile)', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);

      await service.updateApplication('user1', 'token', id, {
        ...updateBody,
        endpoint: 'https://a.example',
        applicationProperties: { endpoint: 'https://b.example' },
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({
        endpoint: 'https://a.example',
        application_properties: { endpoint: 'https://b.example' },
      });
    });

    it('does not merge topics when omitted', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);

      await service.updateApplication('user1', 'token', id, updateBody);

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).not.toHaveProperty('descriptionKeywords');
    });

    it('replaces a previously plain-string displayName with a locale map when locales is provided', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);

      await service.updateApplication('user1', 'token', id, {
        ...updateBody,
        locales: [{ language: 'de', name: 'Aktualisierte App' }],
        primaryLocale: 'en',
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({
        displayName: { en: 'Updated App', de: 'Aktualisierte App' },
      });
    });

    it('drops a previously configured locale map when an update omits locales (full-replacement semantics)', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(
        service,
        okResponse({
          ...existingApp,
          displayName: { en: 'My App', de: 'Meine App' },
        }),
      );

      await service.updateApplication('user1', 'token', id, updateBody);

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({
        displayName: 'Updated App',
      });
    });

    it('throws NotFoundException when the existing application fetch returns 404', async () => {
      const { service } = makeService();
      mockUpdateApplicationSdk(service, errResponse(404));

      await expect(
        service.updateApplication('u', 't', id, updateBody),
      ).rejects.toThrow(HttpException);
    });

    it('throws ForbiddenException when saveCustomApplication returns 403', async () => {
      const { service } = makeService();
      mockUpdateApplicationSdk(service, undefined, errResponse(403));

      await expect(
        service.updateApplication('u', 't', id, updateBody),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadGatewayException when DIAL Core returns a 5xx while saving', async () => {
      const { service } = makeService();
      mockUpdateApplicationSdk(service, undefined, errResponse(500));

      await expect(
        service.updateApplication('u', 't', id, updateBody),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomApplication',
      ).mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        service.updateApplication('u', 't', id, updateBody),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('does not invalidate cache when the update fails', async () => {
      const {
        service,
        cacheManager,
        deploymentsService,
        deploymentsDetailsService,
      } = makeService();
      mockUpdateApplicationSdk(service, undefined, errResponse(409));

      await expect(
        service.updateApplication('user1', 't', id, updateBody),
      ).rejects.toThrow();
      expect(cacheManager.del).not.toHaveBeenCalled();
      expect(deploymentsService.invalidateListCache).not.toHaveBeenCalled();
      expect(
        deploymentsDetailsService.invalidateDetailsCache,
      ).not.toHaveBeenCalled();
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

/*
 * Regression coverage for two bugs found in review of the initial
 * applicationProperties/update-cache change: (1) hoistApplicationFields was
 * being applied on update too, silently stripping a Quick App's own
 * application_properties.features key (e.g. `timestamp`); (2) updateApplication
 * never invalidated the GET .../details cache, so re-opening Edit right after a
 * save could load (and then resave) a stale, pre-update configuration. These use
 * a real DeploymentsDetailsService wired to the same in-memory cache Map as
 * ApplicationsService, instead of a mock, so the cache-invalidation contract
 * between the two services is actually exercised end to end.
 */
describe('updateApplication + GET .../details cache interaction (regression)', () => {
  const id = 'applications/bucket/quick-app__1.0.0';

  function makeIntegrationDeps() {
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
      getApplication: vi.fn(),
      getCustomApplication: vi.fn(),
      saveCustomApplication: vi.fn(),
      getUserBucket: vi.fn(),
    };
    const dialClient = {
      client: sdkClient,
      baseUrl: 'http://dial-core',
      dialApiVersion: '2024-10-21',
    } as unknown as DialClientService;

    const deploymentsService = {
      invalidateListCache: vi.fn().mockResolvedValue(undefined),
    } as unknown as DeploymentsService;

    const deploymentsDetailsService = new DeploymentsDetailsService(
      dialClient,
      cacheManager as never,
    );
    const applicationsService = new ApplicationsService(
      dialClient,
      cacheManager as never,
      deploymentsService,
      deploymentsDetailsService,
    );

    return { sdkClient, applicationsService, deploymentsDetailsService };
  }

  it("a Quick App's own application_properties.features survives a read → save → read round trip", async () => {
    const { sdkClient, applicationsService, deploymentsDetailsService } =
      makeIntegrationDeps();

    const initialProperties = {
      features: { timestamp: true },
      orchestrator: { system_prompt: { type: 'custom' } },
    };
    const updatedProperties = {
      features: { timestamp: false },
      orchestrator: { system_prompt: { type: 'custom' } },
      skills: ['weather'],
    };

    // 1. Initial read.
    sdkClient.getApplication.mockResolvedValueOnce(
      okResponse({ id, application_properties: initialProperties }),
    );
    sdkClient.getCustomApplication.mockResolvedValueOnce(okResponse({}));
    const before = await deploymentsDetailsService.getDeploymentDetails(
      'user1',
      id,
      'token',
    );
    expect(before.applicationDetails?.applicationProperties).toEqual(
      initialProperties,
    );

    // 2. Save: applicationProperties still carries its own `features` key.
    sdkClient.getCustomApplication.mockResolvedValueOnce(
      okResponse({
        displayName: 'Quick App',
        displayVersion: '1.0.0',
        application_type_schema_id: 'https://mydial.epam.com/schema/quickapps2',
        application_properties: initialProperties,
      }),
    );
    sdkClient.saveCustomApplication.mockResolvedValueOnce(okResponse({}));
    await applicationsService.updateApplication('user1', 'token', id, {
      name: 'Quick App',
      applicationProperties: updatedProperties,
    });

    const [, , { body: sentBody }] =
      sdkClient.saveCustomApplication.mock.calls[0];
    expect(sentBody.application_properties).toEqual(updatedProperties);
    // The hoist bug used to lift `features` to the top level, stripping it
    // from application_properties before it reached DIAL Core.
    expect(sentBody).not.toHaveProperty('features');

    // 3. Re-read: must reflect the saved Quick App features, not the original.
    sdkClient.getApplication.mockResolvedValueOnce(
      okResponse({ id, application_properties: updatedProperties }),
    );
    sdkClient.getCustomApplication.mockResolvedValueOnce(okResponse({}));
    const after = await deploymentsDetailsService.getDeploymentDetails(
      'user1',
      id,
      'token',
    );
    expect(after.applicationDetails?.applicationProperties).toEqual(
      updatedProperties,
    );
    expect(sdkClient.getApplication).toHaveBeenCalledTimes(2);
  });

  it('an immediate re-read after save does not return the details cache entry populated before the save', async () => {
    const { sdkClient, applicationsService, deploymentsDetailsService } =
      makeIntegrationDeps();

    const staleProperties = { tool_sets: ['old-toolset'] };
    const freshProperties = { tool_sets: ['new-toolset'] };

    // 1. Pre-populate the details cache (e.g. the Edit form's initial load).
    sdkClient.getApplication.mockResolvedValueOnce(
      okResponse({ id, application_properties: staleProperties }),
    );
    sdkClient.getCustomApplication.mockResolvedValueOnce(okResponse({}));
    const cached = await deploymentsDetailsService.getDeploymentDetails(
      'user1',
      id,
      'token',
    );
    expect(cached.applicationDetails?.applicationProperties).toEqual(
      staleProperties,
    );

    // 2. Save a change to the configuration.
    sdkClient.getCustomApplication.mockResolvedValueOnce(
      okResponse({
        displayName: 'Quick App',
        displayVersion: '1.0.0',
        application_properties: staleProperties,
      }),
    );
    sdkClient.saveCustomApplication.mockResolvedValueOnce(okResponse({}));
    await applicationsService.updateApplication('user1', 'token', id, {
      name: 'Quick App',
      applicationProperties: freshProperties,
    });

    // 3. Immediately re-open Edit: must NOT return the 60 s-cached, pre-save
    // snapshot populated in step 1.
    sdkClient.getApplication.mockResolvedValueOnce(
      okResponse({ id, application_properties: freshProperties }),
    );
    sdkClient.getCustomApplication.mockResolvedValueOnce(okResponse({}));
    const fresh = await deploymentsDetailsService.getDeploymentDetails(
      'user1',
      id,
      'token',
    );

    expect(fresh.applicationDetails?.applicationProperties).toEqual(
      freshProperties,
    );
    // A cache hit would have returned `cached`'s value without a second
    // getApplication call — this proves the cache was actually invalidated.
    expect(sdkClient.getApplication).toHaveBeenCalledTimes(2);
  });
});
