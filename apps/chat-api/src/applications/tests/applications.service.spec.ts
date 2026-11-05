import {
  BadGatewayException,
  ConflictException,
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
      getUserBucket: vi
        .fn()
        .mockResolvedValue(okResponse({ bucket: 'test-bucket' })),
      saveCustomApplication: vi.fn(),
      getCustomApplication: vi.fn(),
      deleteCustomApplication: vi.fn(),
      getApplicationMetadata: vi.fn(),
      moveResource: vi.fn(),
      copyResource: vi.fn(),
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
    listDeployments: vi.fn().mockResolvedValue({ deployments: [] }),
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

function makeToolsetsListing() {
  return {
    listToolsets: vi.fn().mockResolvedValue({ data: [] }),
  };
}

function makeService() {
  const {
    dialClient,
    cacheManager,
    deploymentsService,
    deploymentsDetailsService,
  } = makeDeps();
  const toolsetsListing = makeToolsetsListing();
  const service = new ApplicationsService(
    dialClient,
    cacheManager as never,
    deploymentsService,
    deploymentsDetailsService,
    toolsetsListing as never,
  );
  return {
    service,
    cacheManager,
    deploymentsService,
    deploymentsDetailsService,
    toolsetsListing,
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
        (service['dialClient'] as DialClientService).client,
        'getApplications',
      ).mockResolvedValue(okResponse({ data: [mockApp] }));

      const result = await service.listApplications('user1', 'token-abc');
      expect(result).toEqual(mockList);
    });

    it('returns empty list when upstream data is missing', async () => {
      const { service } = makeService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
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
        makeToolsetsListing() as never,
      );
      const spy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'getApplications',
        )
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
        makeToolsetsListing() as never,
      );
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'getApplications',
        )
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
        (service['dialClient'] as DialClientService).client,
        'getApplications',
      ).mockResolvedValue(errResponse(401));
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getApplications',
      ).mockResolvedValue(errResponse(403));
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on upstream 429', async () => {
      const { service } = makeService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getApplications',
      ).mockResolvedValue(errResponse(429));
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getApplications',
      ).mockResolvedValue(errResponse(500));
      await expect(service.listApplications('u', 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'getUserBucket',
        )
        .mockResolvedValue(bucketResponse);
      const saveCustomApplicationSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveCustomApplication',
        )
        .mockResolvedValue(saveResponse);

      return { getUserBucketSpy, saveCustomApplicationSpy };
    };

    describe('duplicate identity', () => {
      const ownAgent = (
        overrides: Record<string, unknown> = {},
      ): Record<string, unknown> => ({
        id: 'applications/test-bucket/My%20App__1.0.0',
        type: 'application',
        displayName: 'My App',
        displayVersion: '1.0.0',
        interfaces: ['chat'],
        isMy: true,
        ...overrides,
      });

      it('rejects a second agent with the same name and version and writes nothing', async () => {
        const { service, deploymentsService, cacheManager } = makeService();
        const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [ownAgent()],
        } as never);

        const error = await service
          .createApplication('user1', 'token', { ...body, createOnly: true })
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getResponse()).toMatchObject({
          code: 'name-taken-agent',
        });
        expect(saveCustomApplicationSpy).not.toHaveBeenCalled();
        expect(cacheManager.del).not.toHaveBeenCalled();
      });

      it('reads the deployments list fresh', async () => {
        const { service, deploymentsService } = makeService();
        mockCreateApplicationSdk(service);

        await service.createApplication('user1', 'token', {
          ...body,
          createOnly: true,
        });

        expect(deploymentsService.listDeployments).toHaveBeenCalledWith(
          'user1',
          'token',
          'test-bucket',
          undefined,
          true,
        );
      });

      it('accepts the same name and version in a different folder', async () => {
        const { service, deploymentsService } = makeService();
        const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [
            ownAgent({
              id: 'applications/test-bucket/Design/My%20App__1.0.0',
            }),
          ],
        } as never);

        await service.createApplication('user1', 'token', {
          ...body,
          createOnly: true,
          folderPath: 'Research',
        });

        expect(saveCustomApplicationSpy).toHaveBeenCalledOnce();
      });

      it('accepts a different version of the same name', async () => {
        const { service, deploymentsService } = makeService();
        const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [ownAgent()],
        } as never);

        await service.createApplication('user1', 'token', {
          ...body,
          version: '1.1.0',
          createOnly: true,
        });

        expect(saveCustomApplicationSpy).toHaveBeenCalledOnce();
      });

      it('ignores an own toolset with the same name because it competes in another tab', async () => {
        const { service, deploymentsService, toolsetsListing } = makeService();
        const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [],
        } as never);

        await service.createApplication('user1', 'token', {
          ...body,
          createOnly: true,
        });

        expect(saveCustomApplicationSpy).toHaveBeenCalledOnce();
        expect(toolsetsListing.listToolsets).not.toHaveBeenCalled();
      });

      it('reuses a name freed by a rename at the next free path', async () => {
        const { service, deploymentsService } = makeService();
        const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
        saveCustomApplicationSpy
          .mockResolvedValueOnce(errResponse(412))
          .mockResolvedValueOnce(okResponse({}));
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [ownAgent({ displayName: 'My App renamed' })],
        } as never);

        const result = await service.createApplication('user1', 'token', {
          ...body,
          createOnly: true,
        });

        expect(result).toEqual({
          id: 'applications/test-bucket/My%20App-2__1.0.0',
        });
      });

      it('does not check a create that is not create-only', async () => {
        const { service, deploymentsService } = makeService();
        mockCreateApplicationSdk(service);

        await service.createApplication('user1', 'token', body);

        expect(deploymentsService.listDeployments).not.toHaveBeenCalled();
      });

      it('writes nothing when the deployments read fails', async () => {
        const { service, deploymentsService } = makeService();
        const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockRejectedValue(
          new ServiceUnavailableException(),
        );

        await expect(
          service.createApplication('user1', 'token', {
            ...body,
            createOnly: true,
          }),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(saveCustomApplicationSpy).not.toHaveBeenCalled();
      });
    });

    it('creates at the next free path when the name path is already taken', async () => {
      const { service, cacheManager } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
      saveCustomApplicationSpy
        .mockResolvedValueOnce(errResponse(412))
        .mockResolvedValueOnce(errResponse(412));
      const result = await service.createApplication('user1', 'token', {
        ...body,
        createOnly: true,
      });
      expect(
        saveCustomApplicationSpy.mock.calls.map(([, path]) => path),
      ).toEqual(['My%20App__1.0.0', 'My%20App-2__1.0.0', 'My%20App-3__1.0.0']);
      for (const [, , options] of saveCustomApplicationSpy.mock.calls) {
        expect(options.headers).toEqual({
          Authorization: 'Bearer token',
          'If-None-Match': '*',
        });
      }
      /* The retried request still carries the name the user entered. */
      expect(saveCustomApplicationSpy.mock.calls[2][2].body).toBe(
        saveCustomApplicationSpy.mock.calls[0][2].body,
      );
      expect(result).toEqual({
        id: 'applications/test-bucket/My%20App-3__1.0.0',
      });
      expect(cacheManager.del).toHaveBeenCalledWith('applications:list:user1');
    });

    it('rejects with 409 once every candidate path is taken, without invalidating caches', async () => {
      const { service, cacheManager } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(
        service,
        undefined,
        errResponse(412),
      );
      await expect(
        service.createApplication('user1', 'token', {
          ...body,
          createOnly: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(saveCustomApplicationSpy).toHaveBeenCalledTimes(20);
      expect(saveCustomApplicationSpy).toHaveBeenLastCalledWith(
        'test-bucket',
        'My%20App-20__1.0.0',
        expect.objectContaining({
          headers: { Authorization: 'Bearer token', 'If-None-Match': '*' },
        }),
      );
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('does not retry a create-only request on a non-conflict error', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(
        service,
        undefined,
        errResponse(403),
      );
      await expect(
        service.createApplication('user1', 'token', {
          ...body,
          createOnly: true,
        }),
      ).rejects.toThrow();
      expect(saveCustomApplicationSpy).toHaveBeenCalledOnce();
    });

    it('creates inside the requested folder and keeps create-only candidates there', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
      saveCustomApplicationSpy.mockResolvedValueOnce(errResponse(412));
      const result = await service.createApplication('user1', 'token', {
        ...body,
        createOnly: true,
        folderPath: 'My Design/Audit',
      });
      expect(saveCustomApplicationSpy).toHaveBeenNthCalledWith(
        1,
        'test-bucket',
        'My%20Design/Audit/My%20App__1.0.0',
        expect.anything(),
      );
      expect(saveCustomApplicationSpy).toHaveBeenNthCalledWith(
        2,
        'test-bucket',
        'My%20Design/Audit/My%20App-2__1.0.0',
        expect.anything(),
      );
      expect(result).toEqual({
        id: 'applications/test-bucket/My%20Design/Audit/My%20App-2__1.0.0',
      });
    });

    it('creates at the bucket root when folderPath is empty', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
      await service.createApplication('user1', 'token', {
        ...body,
        folderPath: '',
      });
      expect(saveCustomApplicationSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20App__1.0.0',
        expect.anything(),
      );
    });

    it('keeps legacy writes unconditional when createOnly is absent', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
      await service.createApplication('user1', 'token', body);
      expect(
        saveCustomApplicationSpy.mock.calls[0][2].headers,
      ).not.toHaveProperty('If-None-Match');
    });

    it('preserves all template settings independently of Core attachment capabilities', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);
      const properties = {
        features: { timestamp: null, file_loading: { size_limit: 123 } },
        endpoint: 'schema-specific-value',
        inputAttachmentTypes: ['schema-specific-value'],
        maxInputAttachments: 99,
        orchestrator: {
          deployment: {
            deployment_id: 'model-a',
            parameters: { temperature: 0.3 },
          },
        },
        unknownOption: { enabled: true },
      };
      await service.createApplication('user1', 'token', {
        ...body,
        createOnly: true,
        preserveApplicationProperties: true,
        applicationProperties: properties,
        inputAttachmentTypes: ['image/png'],
        maxInputAttachments: 3,
      });
      const sentBody = saveCustomApplicationSpy.mock.calls[0][2].body;
      expect(sentBody).toMatchObject({
        application_properties: properties,
        features: { skills_supported: true },
        inputAttachmentTypes: ['image/png'],
        maxInputAttachments: 3,
      });
      expect(sentBody?.features).not.toHaveProperty('timestamp');
      expect(sentBody).not.toHaveProperty('endpoint');
    });

    it('creates application, returns composite id, and invalidates cache', async () => {
      const { service, cacheManager, deploymentsService } = makeService();
      mockCreateApplicationSdk(service);

      const result = await service.createApplication(
        'user1',
        'token-abc',
        body,
      );
      expect(result).toEqual({
        id: 'applications/test-bucket/My%20App__1.0.0',
      });
      expect(cacheManager.del).toHaveBeenCalledWith('applications:list:user1');
      expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith(
        'user1',
      );
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

    it('defaults version to 1.0.0 when not provided', async () => {
      const { service } = makeService();
      mockCreateApplicationSdk(service);

      const result = await service.createApplication('user1', 't', body);
      expect(result.id).toContain('__1.0.0');
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
            features: {
              system_prompt_supported: false,
              skills_supported: true,
            },
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
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockRejectedValue(new TypeError('fetch failed'));
      await expect(service.createApplication('u', 't', body)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('does not invalidate cache when PUT returns error', async () => {
      const { service, cacheManager, deploymentsService } = makeService();
      mockCreateApplicationSdk(service, undefined, errResponse(409));
      await expect(
        service.createApplication('user1', 't', body),
      ).rejects.toThrow();
      expect(cacheManager.del).not.toHaveBeenCalled();
      expect(deploymentsService.invalidateListCache).not.toHaveBeenCalled();
    });

    it('forces features.skills_supported to true for a Quick App with no applicationProperties.features', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', body);

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody.features).toEqual({
        system_prompt_supported: false,
        skills_supported: true,
      });
    });

    it('lets caller-supplied features override the system_prompt_supported default for a Quick App', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', {
        ...body,
        applicationProperties: { features: { system_prompt_supported: true } },
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody.features).toEqual({
        system_prompt_supported: true,
        skills_supported: true,
      });
    });

    it('stores explicit top-level features without the system_prompt_supported default for a Quick App', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', {
        ...body,
        preserveApplicationProperties: true,
        applicationProperties: {
          features: { file_loading: { size_limit: 1 } },
        },
        features: { tools_supported: true },
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody.features).toEqual({
        tools_supported: true,
        skills_supported: true,
      });
      expect(sentBody.application_properties).toEqual({
        features: { file_loading: { size_limit: 1 } },
      });
    });

    it('prefers explicit top-level features over hoisted ones', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', {
        ...body,
        applicationProperties: { features: { timestamp: true } },
        features: { system_prompt_supported: true },
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody.features).toEqual({
        system_prompt_supported: true,
        skills_supported: true,
      });
    });

    it('merges skills_supported alongside caller-supplied features for a Quick App', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', {
        ...body,
        applicationProperties: { features: { timestamp: true } },
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody.features).toEqual({
        system_prompt_supported: false,
        timestamp: true,
        skills_supported: true,
      });
    });

    it('does not add skills_supported for a non-Quick-App create', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockCreateApplicationSdk(service);

      await service.createApplication('user1', 'token', {
        name: 'My App',
        type: 'https://mydial.epam.com/schema',
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).not.toHaveProperty('features');
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'getCustomApplication',
        )
        .mockResolvedValue(getResponse);
      const saveCustomApplicationSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveCustomApplication',
        )
        .mockResolvedValue(saveResponse);

      return { getCustomApplicationSpy, saveCustomApplicationSpy };
    };

    describe('duplicate identity', () => {
      const entry = (overrides: Record<string, unknown>) => ({
        type: 'application',
        displayVersion: '0.0.1',
        isMy: true,
        ...overrides,
      });
      const selfEntry = (interfaces: string[] = ['chat']) =>
        entry({
          id,
          displayName: 'My App',
          interfaces,
        });

      it('does not read deployments when name and version stay the same', async () => {
        const { service, deploymentsService } = makeService();
        const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);

        await service.updateApplication('user1', 'token', id, {
          name: 'My App',
          description: 'New description',
        });

        expect(deploymentsService.listDeployments).not.toHaveBeenCalled();
        expect(saveCustomApplicationSpy).toHaveBeenCalledOnce();
      });

      it('rejects a rename into the identity of another own agent and writes nothing', async () => {
        const { service, deploymentsService } = makeService();
        const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [
            selfEntry(),
            entry({
              id: 'applications/test-bucket/Taken__0.0.1',
              displayName: 'Taken',
              interfaces: ['chat'],
            }),
          ],
        } as never);

        const error = await service
          .updateApplication('user1', 'token', id, { name: 'Taken' })
          .catch((e: unknown) => e);

        expect((error as ConflictException).getResponse()).toMatchObject({
          code: 'name-taken-agent',
        });
        expect(saveCustomApplicationSpy).not.toHaveBeenCalled();
      });

      it('rejects a version change into an existing version of the same name', async () => {
        const { service, deploymentsService } = makeService();
        mockUpdateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [
            selfEntry(),
            entry({
              id: 'applications/test-bucket/My%20App__1.1.0',
              displayName: 'My App',
              displayVersion: '1.1.0',
              interfaces: ['chat'],
            }),
          ],
        } as never);

        await expect(
          service.updateApplication('user1', 'token', id, {
            name: 'My App',
            version: '1.1.0',
          }),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('checks a dual-interface application against the toolsets as well', async () => {
        const { service, deploymentsService, toolsetsListing } = makeService();
        mockUpdateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [selfEntry(['chat', 'mcp'])],
        } as never);
        vi.mocked(toolsetsListing.listToolsets).mockResolvedValue({
          data: [
            {
              id: 'toolsets/test-bucket/Search__0.0.1',
              displayName: 'Search',
              displayVersion: '0.0.1',
              isMy: true,
            },
          ],
        } as never);

        const error = await service
          .updateApplication('user1', 'token', id, { name: 'Search' })
          .catch((e: unknown) => e);

        expect((error as ConflictException).getResponse()).toMatchObject({
          code: 'name-taken-toolset',
        });
      });

      it('does not read toolsets for a chat-only application', async () => {
        const { service, deploymentsService, toolsetsListing } = makeService();
        mockUpdateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [selfEntry(['chat'])],
        } as never);

        await service.updateApplication('user1', 'token', id, {
          name: 'Search',
        });

        expect(toolsetsListing.listToolsets).not.toHaveBeenCalled();
      });

      it('compares an application missing from the list with the agents tab only', async () => {
        const { service, deploymentsService, toolsetsListing } = makeService();
        mockUpdateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [
            entry({
              id: 'applications/test-bucket/Taken__0.0.1',
              displayName: 'Taken',
              interfaces: ['chat'],
            }),
          ],
        } as never);

        await expect(
          service.updateApplication('user1', 'token', id, { name: 'Taken' }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(toolsetsListing.listToolsets).not.toHaveBeenCalled();
      });

      it('does not check an application the caller does not own', async () => {
        const { service, deploymentsService } = makeService();
        const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [
            { ...selfEntry(), isMy: false },
            entry({
              id: 'applications/test-bucket/Taken__0.0.1',
              displayName: 'Taken',
              interfaces: ['chat'],
            }),
          ],
        } as never);

        await service.updateApplication('user1', 'token', id, {
          name: 'Taken',
        });

        expect(saveCustomApplicationSpy).toHaveBeenCalledOnce();
      });
    });

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

    it('removes the stored icon when iconUrl is an empty string', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(
        service,
        okResponse({ ...existingApp, iconUrl: 'files/test-bucket/icon.png' }),
      );

      await service.updateApplication('user1', 'token', id, {
        ...updateBody,
        iconUrl: '',
      });

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).not.toHaveProperty('iconUrl');
      expect(sentBody).toMatchObject({
        displayName: updateBody.name,
        application_properties: existingApp.application_properties,
      });
    });

    it('keeps the stored icon when iconUrl is omitted', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(
        service,
        okResponse({ ...existingApp, iconUrl: 'files/test-bucket/icon.png' }),
      );

      await service.updateApplication('user1', 'token', id, updateBody);

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).toMatchObject({ iconUrl: 'files/test-bucket/icon.png' });
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
        (service['dialClient'] as DialClientService).client,
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

    it('forces features.skills_supported to true when updating an existing Quick App, even when features is omitted', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(
        service,
        okResponse({
          ...existingApp,
          application_type_schema_id:
            'https://mydial.epam.com/schema/quickapps2',
        }),
      );

      await service.updateApplication('user1', 'token', id, updateBody);

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody.features).toEqual({ skills_supported: true });
    });

    it('does not add skills_supported when updating a non-Quick-App', async () => {
      const { service } = makeService();
      const { saveCustomApplicationSpy } = mockUpdateApplicationSdk(service);

      await service.updateApplication('user1', 'token', id, updateBody);

      const [, , { body: sentBody }] = saveCustomApplicationSpy.mock.calls[0];
      expect(sentBody).not.toHaveProperty('features');
    });
  });

  describe('deleteApplication', () => {
    const id = 'applications/test-bucket/My%20App__0.0.1';

    it('DELETEs the application id path and invalidates cache', async () => {
      const { service, cacheManager } = makeService();
      const deleteSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'deleteCustomApplication',
        )
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
        (service['dialClient'] as DialClientService).client,
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
        (service['dialClient'] as DialClientService).client,
        'deleteCustomApplication',
      ).mockResolvedValue(errResponse(409));

      await expect(
        service.deleteApplication('user1', 't', id),
      ).rejects.toThrow();
      expect(deploymentsService.invalidateListCache).not.toHaveBeenCalled();
    });

    it('resolves bucket via getUserBucket when applicationName has no bucket prefix', async () => {
      const { service } = makeService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(okResponse({ bucket: 'my-bucket' }));
      const deleteSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'deleteCustomApplication',
        )
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
        (service['dialClient'] as DialClientService).client,
        'deleteCustomApplication',
      ).mockResolvedValue(errResponse(403));
      await expect(service.deleteApplication('u', 't', id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'deleteCustomApplication',
      ).mockRejectedValue(new TypeError('fetch failed'));
      await expect(service.deleteApplication('u', 't', id)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('does not invalidate cache when delete returns error', async () => {
      const { service, cacheManager } = makeService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
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
      { get: vi.fn() } as never,
    );
    const applicationsService = new ApplicationsService(
      dialClient,
      cacheManager as never,
      deploymentsService,
      deploymentsDetailsService,
      makeToolsetsListing() as never,
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
    // from application_properties before it reached DIAL Core. The top-level
    // `features` seen here comes only from the Quick-App skills_supported
    // force-set, not from a hoist of application_properties.features.
    expect(sentBody.features).toEqual({ skills_supported: true });
    expect(sentBody.application_properties.features).toEqual({
      timestamp: false,
    });

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

  describe('personal folders and versions', () => {
    const client = (service: ApplicationsService) =>
      vi.mocked((service['dialClient'] as DialClientService).client);

    const withBucket = (service: ApplicationsService, bucket = 'b1') =>
      client(service).getUserBucket.mockResolvedValue(okResponse({ bucket }));

    const appResponse = (body: Record<string, unknown>, etag: string) =>
      ({
        data: body,
        response: { status: 200, headers: new Headers({ etag }) },
      }) as never;

    it('lists the folders of the caller bucket', async () => {
      const { service } = makeService();
      withBucket(service);
      client(service).getApplicationMetadata.mockResolvedValue({
        data: {
          items: [
            { name: 'Design', nodeType: 'FOLDER' },
            { name: 'agent__1.0.0', nodeType: 'ITEM' },
          ],
        },
        response: { status: 200 },
      } as never);

      await expect(
        service.listApplicationFolders('token', ''),
      ).resolves.toEqual({
        folders: [{ name: 'Design', path: 'Design' }],
      });
      expect(client(service).getApplicationMetadata).toHaveBeenCalledWith(
        'b1',
        '',
        expect.anything(),
      );
    });

    describe('fork and move duplicate identity', () => {
      const entry = (id: string, overrides: Record<string, unknown> = {}) => ({
        id,
        type: 'application',
        displayName: 'agent',
        displayVersion: '1.0.0',
        interfaces: ['chat'],
        isMy: true,
        ...overrides,
      });

      it('rejects a move into a folder that already holds the same identity', async () => {
        const { service, deploymentsService } = makeService();
        withBucket(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [
            entry('applications/b1/agent__1.0.0'),
            entry('applications/b1/Design/other__1.0.0'),
          ],
        } as never);

        const error = await service
          .moveApplication(
            'user1',
            'token',
            'applications/b1/agent__1.0.0',
            'Design',
          )
          .catch((e: unknown) => e);

        expect((error as ConflictException).getResponse()).toMatchObject({
          code: 'name-taken-agent',
        });
        expect(client(service).moveResource).not.toHaveBeenCalled();
      });

      it('rejects a fork to a version that already exists in the folder', async () => {
        const { service, deploymentsService } = makeService();
        withBucket(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [
            entry('applications/b1/agent__1.0.0'),
            entry('applications/b1/Design/agent__1.1.1', {
              displayVersion: '1.1.1',
            }),
          ],
        } as never);

        const error = await service
          .forkApplicationVersion(
            'user1',
            'token',
            'applications/b1/agent__1.0.0',
            { version: '1.1.1', folderPath: 'Design' },
          )
          .catch((e: unknown) => e);

        expect((error as ConflictException).getResponse()).toMatchObject({
          code: 'name-taken-agent',
        });
        expect(client(service).copyResource).not.toHaveBeenCalled();
      });

      it('rejects a fork onto the source identity because the source stays in place', async () => {
        const { service, deploymentsService } = makeService();
        withBucket(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [entry('applications/b1/agent__1.0.0')],
        } as never);

        await expect(
          service.forkApplicationVersion(
            'user1',
            'token',
            'applications/b1/agent__1.0.0',
            { version: '1.0.0', folderPath: '' },
          ),
        ).rejects.toBeInstanceOf(ConflictException);
      });

      it('forks to a free version', async () => {
        const { service, deploymentsService } = makeService();
        withBucket(service);
        vi.mocked(deploymentsService.listDeployments).mockResolvedValue({
          deployments: [entry('applications/b1/agent__1.0.0')],
        } as never);
        client(service).copyResource.mockResolvedValue({
          response: { status: 200 },
        } as never);
        client(service).getCustomApplication.mockResolvedValue({
          data: { displayName: 'agent', displayVersion: '1.0.0' },
          response: { status: 200, headers: new Headers({ etag: 'e1' }) },
        } as never);
        client(service).saveCustomApplication.mockResolvedValue(okResponse({}));

        await expect(
          service.forkApplicationVersion(
            'user1',
            'token',
            'applications/b1/agent__1.0.0',
            { version: '1.1.1', folderPath: '' },
          ),
        ).resolves.toEqual({ id: 'applications/b1/agent__1.1.1' });
      });
    });

    it('moves an own application into a folder and invalidates caches', async () => {
      const { service, cacheManager, deploymentsDetailsService } =
        makeService();
      withBucket(service);
      client(service).moveResource.mockResolvedValue({
        response: { status: 200 },
      } as never);

      const result = await service.moveApplication(
        'user1',
        'token',
        'applications/b1/agent__1.0.0',
        'My Design',
      );

      expect(result).toEqual({
        id: 'applications/b1/My%20Design/agent__1.0.0',
      });
      expect(client(service).moveResource).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
        body: {
          sourceUrl: 'applications/b1/agent__1.0.0',
          destinationUrl: 'applications/b1/My%20Design/agent__1.0.0',
          overwrite: false,
        },
      });
      expect(cacheManager.del).toHaveBeenCalledWith('applications:list:user1');
      expect(
        deploymentsDetailsService.invalidateDetailsCache,
      ).toHaveBeenCalledWith('user1', 'applications/b1/agent__1.0.0');
    });

    it('skips the move when the application is already in the folder', async () => {
      const { service } = makeService();
      withBucket(service);

      const result = await service.moveApplication(
        'user1',
        'token',
        'applications/b1/Design/agent__1.0.0',
        'Design',
      );

      expect(result).toEqual({ id: 'applications/b1/Design/agent__1.0.0' });
      expect(client(service).moveResource).not.toHaveBeenCalled();
    });

    it('rejects moving an application from another bucket', async () => {
      const { service } = makeService();
      withBucket(service);

      await expect(
        service.moveApplication(
          'user1',
          'token',
          'applications/other/agent__1.0.0',
          'Design',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(client(service).moveResource).not.toHaveBeenCalled();
    });

    it('forks into the new version path and stamps the version', async () => {
      const { service } = makeService();
      withBucket(service);
      client(service).copyResource.mockResolvedValue({
        response: { status: 200 },
      } as never);
      client(service).getCustomApplication.mockResolvedValue(
        appResponse({ displayVersion: '1.0.0', description: 'pre' }, 'e1'),
      );
      client(service).saveCustomApplication.mockResolvedValue(okResponse({}));

      const result = await service.forkApplicationVersion(
        'user1',
        'token',
        'applications/b1/agent__1.0.0',
        { version: '1.1.0', folderPath: 'Design' },
      );

      expect(result).toEqual({ id: 'applications/b1/Design/agent__1.1.0' });
      expect(client(service).copyResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            sourceUrl: 'applications/b1/agent__1.0.0',
            destinationUrl: 'applications/b1/Design/agent__1.1.0',
            overwrite: false,
          },
        }),
      );
      expect(client(service).saveCustomApplication).toHaveBeenCalledWith(
        'b1',
        'Design/agent__1.1.0',
        {
          headers: { Authorization: 'Bearer token', 'If-Match': 'e1' },
          body: { displayVersion: '1.1.0', description: 'pre' },
        },
      );
    });

    it('keeps a separator inside the name when forking', async () => {
      const { service } = makeService();
      withBucket(service);
      client(service).copyResource.mockResolvedValue({
        response: { status: 200 },
      } as never);
      client(service).getCustomApplication.mockResolvedValue(
        appResponse({ displayVersion: '1.0.0' }, 'e1'),
      );
      client(service).saveCustomApplication.mockResolvedValue(okResponse({}));

      const result = await service.forkApplicationVersion(
        'user1',
        'token',
        'applications/b1/my__app__1.0.0',
        { version: '1.1.0', folderPath: '' },
      );

      expect(result).toEqual({ id: 'applications/b1/my__app__1.1.0' });
    });

    it('deletes the copy when stamping the version fails', async () => {
      const { service } = makeService();
      withBucket(service);
      client(service).copyResource.mockResolvedValue({
        response: { status: 200 },
      } as never);
      client(service).getCustomApplication.mockResolvedValue(
        appResponse({ displayVersion: '1.0.0' }, 'e1'),
      );
      client(service).saveCustomApplication.mockResolvedValue(errResponse(500));
      client(service).deleteCustomApplication.mockResolvedValue(
        okResponse(undefined),
      );

      await expect(
        service.forkApplicationVersion(
          'user1',
          'token',
          'applications/b1/agent__1.0.0',
          { version: '1.1.0', folderPath: '' },
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(client(service).deleteCustomApplication).toHaveBeenCalledWith(
        'b1',
        'agent__1.1.0',
        expect.anything(),
      );
    });

    it('reports an existing version as a conflict', async () => {
      const { service } = makeService();
      withBucket(service);
      client(service).copyResource.mockResolvedValue(errResponse(400));
      client(service).getApplicationMetadata.mockResolvedValue({
        data: {},
        response: { status: 200 },
      } as never);

      await expect(
        service.forkApplicationVersion(
          'user1',
          'token',
          'applications/b1/agent__1.0.0',
          { version: '1.1.0', folderPath: '' },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('commits by moving the edits to the snapshot first and then restoring the source', async () => {
      const { service } = makeService();
      withBucket(service);
      client(service).getCustomApplication.mockImplementation(((
        _bucket: string,
        path: string,
      ) =>
        Promise.resolve(
          path === 'agent__1.0.0'
            ? appResponse(
                { displayVersion: '1.0.0', description: 'edited' },
                'src',
              )
            : appResponse(
                { displayVersion: '1.1.0', description: 'pre' },
                'snap',
              ),
        )) as never);
      client(service).saveCustomApplication.mockResolvedValue(okResponse({}));

      const result = await service.commitApplicationVersion(
        'user1',
        'token',
        'applications/b1/agent__1.0.0',
        { snapshotId: 'applications/b1/agent__1.1.0' },
      );

      expect(result).toEqual({ id: 'applications/b1/agent__1.1.0' });
      expect(client(service).saveCustomApplication).toHaveBeenNthCalledWith(
        2,
        'b1',
        'agent__1.0.0',
        {
          headers: { Authorization: 'Bearer token', 'If-Match': 'src' },
          body: { displayVersion: '1.0.0', description: 'pre' },
        },
      );
      expect(client(service).saveCustomApplication).toHaveBeenNthCalledWith(
        1,
        'b1',
        'agent__1.1.0',
        {
          headers: { Authorization: 'Bearer token', 'If-Match': 'snap' },
          body: { displayVersion: '1.1.0', description: 'edited' },
        },
      );
    });

    it('rolls the snapshot back and keeps the edits in the source when restoring the source fails', async () => {
      const { service } = makeService();
      withBucket(service);
      client(service).getCustomApplication.mockImplementation(((
        _bucket: string,
        path: string,
      ) =>
        Promise.resolve(
          path === 'agent__1.0.0'
            ? appResponse(
                { displayVersion: '1.0.0', description: 'edited' },
                'src',
              )
            : appResponse(
                { displayVersion: '1.1.0', description: 'pre' },
                'snap',
              ),
        )) as never);
      client(service).saveCustomApplication.mockImplementation(((
        _bucket: string,
        path: string,
      ) =>
        Promise.resolve(
          path === 'agent__1.0.0' ? errResponse(500) : okResponse({}),
        )) as never);

      await expect(
        service.commitApplicationVersion(
          'user1',
          'token',
          'applications/b1/agent__1.0.0',
          { snapshotId: 'applications/b1/agent__1.1.0' },
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(client(service).saveCustomApplication).toHaveBeenCalledTimes(3);
      expect(client(service).saveCustomApplication).toHaveBeenNthCalledWith(
        3,
        'b1',
        'agent__1.1.0',
        {
          headers: { Authorization: 'Bearer token' },
          body: { displayVersion: '1.1.0', description: 'pre' },
        },
      );
    });

    it('leaves both resources untouched when writing the snapshot fails', async () => {
      const { service } = makeService();
      withBucket(service);
      client(service).getCustomApplication.mockResolvedValue(
        appResponse({ displayVersion: '1.0.0' }, 'e'),
      );
      client(service).saveCustomApplication.mockResolvedValue(errResponse(500));

      await expect(
        service.commitApplicationVersion(
          'user1',
          'token',
          'applications/b1/agent__1.0.0',
          { snapshotId: 'applications/b1/agent__1.1.0' },
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(client(service).saveCustomApplication).toHaveBeenCalledOnce();
      expect(client(service).saveCustomApplication).toHaveBeenCalledWith(
        'b1',
        'agent__1.1.0',
        expect.anything(),
      );
    });

    it('answers 409 when a resource changed before the commit wrote it', async () => {
      const { service } = makeService();
      withBucket(service);
      client(service).getCustomApplication.mockResolvedValue(
        appResponse({ displayVersion: '1.0.0' }, 'e'),
      );
      client(service).saveCustomApplication.mockResolvedValue(errResponse(412));

      await expect(
        service.commitApplicationVersion(
          'user1',
          'token',
          'applications/b1/agent__1.0.0',
          { snapshotId: 'applications/b1/agent__1.1.0' },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a snapshot from another bucket', async () => {
      const { service } = makeService();
      withBucket(service);

      await expect(
        service.commitApplicationVersion(
          'user1',
          'token',
          'applications/b1/agent__1.0.0',
          { snapshotId: 'applications/other/agent__1.1.0' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(client(service).saveCustomApplication).not.toHaveBeenCalled();
    });
  });
});
