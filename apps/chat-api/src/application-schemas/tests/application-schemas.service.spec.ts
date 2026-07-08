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
import { ApplicationSchemasService } from '../application-schemas.service';
import type { ApplicationSchemasResponseDto } from '../dto/application-schema.dto';

const mockSummary = {
  $id: 'https://example.com/schemas/quick-app',
  'dial:applicationTypeDisplayName': 'Quick App',
  'dial:applicationTypeViewerUrl': 'https://example.com/viewer',
  'dial:applicationTypeEditorUrl': 'https://example.com/editor',
  'dial:applicationTypeSchemaEndpoint': 'https://example.com/schema',
};

const expectedDto = {
  id: 'https://example.com/schemas/quick-app',
  displayName: 'Quick App',
  viewerUrl: 'https://example.com/viewer',
  editorUrl: 'https://example.com/editor',
  schemaEndpoint: 'https://example.com/schema',
};

const mockList: ApplicationSchemasResponseDto = { schemas: [expectedDto] };

const mockSchema: Record<string, unknown> = {
  $id: 'https://example.com/schemas/quick-app',
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Quick App',
};

const okListResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const okItemResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

function makeDeps() {
  const dialClient = {
    client: {
      listCustomApplicationSchemas: vi.fn(),
      getCustomApplicationSchema: vi.fn(),
    },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const cacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  };

  const configService = { get: vi.fn().mockReturnValue(undefined) };

  return { dialClient, cacheManager, configService };
}

function makeService() {
  const { dialClient, cacheManager, configService } = makeDeps();
  const service = new ApplicationSchemasService(
    dialClient,
    configService as never,
    cacheManager as never,
  );
  return { service, cacheManager };
}

describe('ApplicationSchemasService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listApplicationSchemas', () => {
    it('returns normalized schema list from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockResolvedValue(okListResponse([mockSummary]));

      const result = await service.listApplicationSchemas('user1', 'token-abc');
      expect(result).toEqual(mockList);
    });

    it('maps upstream fields correctly ($id → id, colon-fields → camelCase)', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockResolvedValue(okListResponse([mockSummary]));

      const result = await service.listApplicationSchemas('user1', 'tok');
      expect(result.schemas[0]).toEqual(expectedDto);
    });

    it('returns empty schemas array when upstream returns empty list', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockResolvedValue(okListResponse([]));

      const result = await service.listApplicationSchemas('user1', 'tok');
      expect(result).toEqual({ schemas: [] });
    });

    it('returns cached result without calling upstream on cache hit', async () => {
      const { dialClient, configService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockList),
        set: vi.fn(),
      };
      const service = new ApplicationSchemasService(
        dialClient,
        configService as never,
        cacheManager as never,
      );
      const spy = vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      );

      const result = await service.listApplicationSchemas('user1', 'tok');
      expect(result).toEqual(mockList);
      expect(spy).not.toHaveBeenCalled();
    });

    it('uses per-user cache keys — different users get different cache entries', async () => {
      const { dialClient, configService } = makeDeps();
      const store = new Map<string, unknown>();
      const cacheManager = {
        get: vi.fn((key: string) => Promise.resolve(store.get(key))),
        set: vi.fn((key: string, value: unknown) => {
          store.set(key, value);
          return Promise.resolve();
        }),
      };
      const service = new ApplicationSchemasService(
        dialClient,
        configService as never,
        cacheManager as never,
      );
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockResolvedValue(okListResponse([mockSummary]));

      await service.listApplicationSchemas('user1', 'tok1');
      await service.listApplicationSchemas('user2', 'tok2');

      expect(cacheManager.get).toHaveBeenCalledWith(
        'application-schemas:list:user1',
      );
      expect(cacheManager.get).toHaveBeenCalledWith(
        'application-schemas:list:user2',
      );
    });

    it('forwards Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'listCustomApplicationSchemas')
        .mockResolvedValue(okListResponse([mockSummary]));

      await service.listApplicationSchemas('user1', 'my-token');
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('maps dial:applicationTypeIconUrl to iconUrl when present', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockResolvedValue(
        okListResponse([
          {
            ...mockSummary,
            'dial:applicationTypeIconUrl': 'https://example.com/icon.png',
          },
        ]),
      );
      const result = await service.listApplicationSchemas('user1', 'token');
      expect(result.schemas[0].iconUrl).toBe('https://example.com/icon.png');
    });

    it('leaves iconUrl undefined when dial:applicationTypeIconUrl is absent', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockResolvedValue(okListResponse([mockSummary]));
      const result = await service.listApplicationSchemas('user1', 'token');
      expect(result.schemas[0].iconUrl).toBeUndefined();
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockResolvedValue(errResponse(401));
      await expect(service.listApplicationSchemas('u', 't')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockResolvedValue(errResponse(403));
      await expect(service.listApplicationSchemas('u', 't')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws HttpException(429) on upstream 429', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockResolvedValue(errResponse(429));
      await expect(service.listApplicationSchemas('u', 't')).rejects.toThrow(
        HttpException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockResolvedValue(errResponse(500));
      await expect(service.listApplicationSchemas('u', 't')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'listCustomApplicationSchemas',
      ).mockRejectedValue(new TypeError('fetch failed'));
      await expect(service.listApplicationSchemas('u', 't')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getApplicationSchema', () => {
    it('returns schema from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomApplicationSchema',
      ).mockResolvedValue(okItemResponse(mockSchema));

      const result = await service.getApplicationSchema(
        'user1',
        'tok',
        'schema-id',
      );
      expect(result).toEqual(mockSchema);
    });

    it('returns cached schema without calling upstream on cache hit', async () => {
      const { dialClient, configService } = makeDeps();
      const cacheManager = {
        get: vi.fn().mockResolvedValue(mockSchema),
        set: vi.fn(),
      };
      const service = new ApplicationSchemasService(
        dialClient,
        configService as never,
        cacheManager as never,
      );
      const spy = vi.spyOn(
        service['dialClient'].client,
        'getCustomApplicationSchema',
      );

      const result = await service.getApplicationSchema(
        'user1',
        'tok',
        'schema-id',
      );
      expect(result).toEqual(mockSchema);
      expect(spy).not.toHaveBeenCalled();
    });

    it('uses per-user-per-schema cache key', async () => {
      const { dialClient, configService } = makeDeps();
      const store = new Map<string, unknown>();
      const cacheManager = {
        get: vi.fn((key: string) => Promise.resolve(store.get(key))),
        set: vi.fn((key: string, value: unknown) => {
          store.set(key, value);
          return Promise.resolve();
        }),
      };
      const service = new ApplicationSchemasService(
        dialClient,
        configService as never,
        cacheManager as never,
      );
      vi.spyOn(
        service['dialClient'].client,
        'getCustomApplicationSchema',
      ).mockResolvedValue(okItemResponse(mockSchema));

      await service.getApplicationSchema('user1', 'tok1', 'sid-A');
      await service.getApplicationSchema('user2', 'tok2', 'sid-A');

      expect(cacheManager.get).toHaveBeenCalledWith(
        'application-schemas:item:user1:sid-A',
      );
      expect(cacheManager.get).toHaveBeenCalledWith(
        'application-schemas:item:user2:sid-A',
      );
    });

    it('forwards Authorization header to upstream', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getCustomApplicationSchema')
        .mockResolvedValue(okItemResponse(mockSchema));

      await service.getApplicationSchema('user1', 'my-token', 'sid');
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
        'getCustomApplicationSchema',
      ).mockResolvedValue(errResponse(401));
      await expect(
        service.getApplicationSchema('u', 't', 'sid'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomApplicationSchema',
      ).mockResolvedValue(errResponse(403));
      await expect(
        service.getApplicationSchema('u', 't', 'sid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomApplicationSchema',
      ).mockResolvedValue(errResponse(404));
      await expect(
        service.getApplicationSchema('u', 't', 'sid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomApplicationSchema',
      ).mockResolvedValue(errResponse(500));
      await expect(
        service.getApplicationSchema('u', 't', 'sid'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomApplicationSchema',
      ).mockRejectedValue(new TypeError('fetch failed'));
      await expect(
        service.getApplicationSchema('u', 't', 'sid'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
