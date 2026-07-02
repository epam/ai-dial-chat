import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DeploymentsService } from '../deployments.service';
import type { DeploymentItemDto } from '../dto/deployment-item.dto';
import { DeploymentInterfaceType } from '../dto/deployments-query.dto';

const mockModel = {
  id: 'gpt-4o',
  object: 'model',
  display_name: 'GPT-4o',
  interfaces: ['chat'],
};
const mockApplication = {
  id: 'my-app',
  object: 'application',
  display_name: 'My App',
  interfaces: ['custom_ui'],
};
const mockToolset = {
  id: 'search-tool',
  toolset: 'search-tool',
  display_name: 'Search Tool',
  interfaces: ['mcp'],
};
const mockNoId = { object: 'model', display_name: 'No ID' };
const mockNoDisplayName = { id: 'no-name', object: 'model' };

function makeService(
  overrides: {
    cached?: DeploymentItemDto[];
    installedIds?: { toolsets: string[]; deployments: string[] };
  } = {},
) {
  const store = new Map<string, unknown>();
  if (overrides.cached) {
    store.set('deployments:list:user1', overrides.cached);
  }

  const cacheManager = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  };

  const sdkClient = {
    getDeploymentsByInterfaceType: vi.fn().mockResolvedValue({
      error: false,
      response: { status: 200 },
      data: [mockModel, mockApplication, mockToolset],
    }),
    configurationDeployment: vi.fn(),
    getDeploymentLimits: vi.fn(),
  };

  const configService = {
    get: vi.fn().mockReturnValue('http://dial-core'),
  } as unknown as ConfigService<EnvironmentVariables>;

  const userConfigService = {
    getInstalledIds: vi
      .fn()
      .mockResolvedValue(
        overrides.installedIds ?? { toolsets: [], deployments: [] },
      ),
  };

  const service = new DeploymentsService(
    configService,
    cacheManager as never,
    userConfigService as never,
  );
  (service as unknown as { client: typeof sdkClient }).client = sdkClient;

  return { service, sdkClient, cacheManager, userConfigService };
}

const okResponse = <T>(data: T) =>
  ({
    error: undefined,
    response: { status: 200 },
    data,
  }) as never;

const errResponse = (status: number) =>
  ({
    error: true as const,
    response: { status },
    data: undefined,
  }) as never;

describe('DeploymentsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listDeployments', () => {
    it('maps model, application, and toolset correctly', async () => {
      const { service } = makeService();
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments).toHaveLength(3);
      expect(result.deployments.find((d) => d.id === 'gpt-4o')?.type).toBe(
        'model',
      );
      expect(result.deployments.find((d) => d.id === 'my-app')?.type).toBe(
        'application',
      );
      expect(result.deployments.find((d) => d.id === 'search-tool')?.type).toBe(
        'toolset',
      );
    });

    it('skips items without id', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockModel, mockNoId],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].id).toBe('gpt-4o');
    });

    it('falls back displayName to id when display_name is absent', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockNoDisplayName],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].displayName).toBe('no-name');
    });

    it('returns cached value without calling SDK on cache hit', async () => {
      const cached: DeploymentItemDto[] = [
        { id: 'cached', displayName: 'Cached', type: 'model' },
      ];
      const { service, sdkClient } = makeService({ cached });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0]).toMatchObject(cached[0]);
      expect(sdkClient.getDeploymentsByInterfaceType).not.toHaveBeenCalled();
    });

    it('applies interface_type filter in-process after cache hit', async () => {
      const cached: DeploymentItemDto[] = [
        {
          id: 'chat-model',
          displayName: 'Chat',
          type: 'model',
          interfaces: ['chat'],
        },
        {
          id: 'embed-model',
          displayName: 'Embed',
          type: 'model',
          interfaces: ['embedding'],
        },
        { id: 'no-iface', displayName: 'None', type: 'model' },
      ];
      const { service } = makeService({ cached });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
        [DeploymentInterfaceType.Chat],
      );
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].id).toBe('chat-model');
    });

    it('forwards interface_type filter to DIAL Core on cache miss', async () => {
      const { service, sdkClient } = makeService();

      await service.listDeployments('user1', 'token', 'bucket-1', [
        DeploymentInterfaceType.Chat,
        DeploymentInterfaceType.Mcp,
      ]);

      expect(sdkClient.getDeploymentsByInterfaceType).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
          params: {
            query: {
              interface_type: ['chat', 'mcp'],
            },
          },
        }),
      );
    });

    it('maps application_type_schema_id to applicationTypeSchemaId for application deployments', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            application_type_schema_id: 'https://example.com/schemas/quick-app',
          },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationTypeSchemaId).toBe(
        'https://example.com/schemas/quick-app',
      );
    });

    it('does not set applicationTypeSchemaId for model deployments', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockModel],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationTypeSchemaId).toBeUndefined();
    });

    it('maps input_attachment_types to inputAttachmentTypes', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          { ...mockModel, input_attachment_types: ['audio/*', 'image/*'] },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].inputAttachmentTypes).toEqual([
        'audio/*',
        'image/*',
      ]);
    });

    it('leaves inputAttachmentTypes undefined when source field is absent', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockModel],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].inputAttachmentTypes).toBeUndefined();
    });

    it('throws BadGatewayException when DIAL Core returns non-2xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: true,
        response: { status: 502 },
        data: undefined,
      });
      await expect(
        service.listDeployments('user1', 'token', 'bucket-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException when DIAL Core is unreachable', async () => {
      const { service, sdkClient } = makeService();
      const abortError = new Error('fetch failed');
      abortError.name = 'AbortError';
      sdkClient.getDeploymentsByInterfaceType.mockRejectedValue(abortError);
      await expect(
        service.listDeployments('user1', 'token', 'bucket-1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('sets isInstalled=true for installed model and application deployments', async () => {
      const { service } = makeService({
        installedIds: { toolsets: [], deployments: ['gpt-4o', 'my-app'] },
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(
        result.deployments.find((d) => d.id === 'gpt-4o')?.isInstalled,
      ).toBe(true);
      expect(
        result.deployments.find((d) => d.id === 'my-app')?.isInstalled,
      ).toBe(true);
      expect(
        result.deployments.find((d) => d.id === 'search-tool')?.isInstalled,
      ).toBe(false);
    });

    it('sets isInstalled=true for installed toolset', async () => {
      const { service } = makeService({
        installedIds: { toolsets: ['search-tool'], deployments: [] },
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(
        result.deployments.find((d) => d.id === 'search-tool')?.isInstalled,
      ).toBe(true);
      expect(
        result.deployments.find((d) => d.id === 'gpt-4o')?.isInstalled,
      ).toBe(false);
    });

    it('sets isInstalled=false for all items when nothing is installed', async () => {
      const { service } = makeService();
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments.every((d) => d.isInstalled === false)).toBe(
        true,
      );
    });

    it('passes token and bucket to userConfigService.getInstalledIds', async () => {
      const { service, userConfigService } = makeService();
      await service.listDeployments('user1', 'my-token', 'my-bucket');
      expect(userConfigService.getInstalledIds).toHaveBeenCalledWith(
        'my-token',
        'my-bucket',
      );
    });

    it('overlays isInstalled after cache hit', async () => {
      const cached: DeploymentItemDto[] = [
        { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
      ];
      const { service } = makeService({
        cached,
        installedIds: { toolsets: [], deployments: ['gpt-4o'] },
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].isInstalled).toBe(true);
    });

    it('forwards owner when present in raw payload', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockModel, owner: 'users/alice@example.com' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].owner).toBe('users/alice@example.com');
    });

    it('leaves owner undefined when not in raw payload', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockModel],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].owner).toBeUndefined();
    });

    it('sets applicationFolder for nested application deployment', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockApplication, id: 'folder1/my-app' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationFolder).toBe('folder1');
    });

    it('sets applicationFolder for deeply nested application deployment', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockApplication, id: 'a/b/my-app' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationFolder).toBe('a/b');
    });

    it('leaves applicationFolder absent for root-level application', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockApplication],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationFolder).toBeUndefined();
    });

    it('leaves applicationFolder absent for model deployments', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockModel, id: 'folder/gpt-4o' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationFolder).toBeUndefined();
    });

    it('leaves applicationFolder absent for toolset deployments', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [{ ...mockToolset, id: 'folder/search-tool' }],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'bucket-1',
      );
      expect(result.deployments[0].applicationFolder).toBeUndefined();
    });

    it('sets isMy=true when bucket appears as a path segment in id', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            id: 'applications/BUCKET_HASH/my-app',
            owner: 'Valery Dluski',
          },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].isMy).toBe(true);
    });

    it('sets isMy=false when bucket does not appear in id', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [
          {
            ...mockApplication,
            id: 'applications/OTHER_BUCKET/their-app',
            owner: 'Other User',
          },
        ],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].isMy).toBe(false);
    });

    it('sets isMy=false for root-level app whose id has no path segments matching bucket', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: [mockApplication],
      });
      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].isMy).toBe(false);
    });

    it('re-evaluates isMy after cache hit using current bucket', async () => {
      const cached: DeploymentItemDto[] = [
        {
          id: 'applications/BUCKET_HASH/my-app',
          displayName: 'My App',
          type: 'application',
          isMy: false,
        },
      ];
      const { service } = makeService({ cached });
      const result = await service.listDeployments(
        'user1',
        'token',
        'BUCKET_HASH',
      );
      expect(result.deployments[0].isMy).toBe(true);
    });
  });

  describe('getDeploymentConfiguration', () => {
    const schema = { type: 'object', title: 'StatGPT Config', properties: {} };

    it('returns configuration schema from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'configurationDeployment').mockResolvedValue(
        okResponse(schema),
      );

      const result = await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'token',
      );
      expect(result).toEqual(schema);
    });

    it('forwards Authorization header to DIAL Core', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['client'], 'configurationDeployment')
        .mockResolvedValue(okResponse(schema));

      await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'my-token',
      );
      expect(spy).toHaveBeenCalledWith(
        'statgpt',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('returns cached value and skips upstream on cache hit', async () => {
      const { service, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(schema);
      const spy = vi.spyOn(service['client'], 'configurationDeployment');

      const result = await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'token',
      );
      expect(result).toEqual(schema);
      expect(spy).not.toHaveBeenCalled();
    });

    it('stores result in cache with 60 s TTL on success', async () => {
      const { service, cacheManager } = makeService();
      vi.spyOn(service['client'], 'configurationDeployment').mockResolvedValue(
        okResponse(schema),
      );

      await service.getDeploymentConfiguration('statgpt', 'user-123', 'token');
      expect(cacheManager.set).toHaveBeenCalledWith(
        'deployments:configuration:user-123:statgpt',
        schema,
        60 * 1000,
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'configurationDeployment').mockResolvedValue(
        errResponse(404),
      );
      await expect(
        service.getDeploymentConfiguration('unknown', 'user-123', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'configurationDeployment').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(
        service.getDeploymentConfiguration('statgpt', 'user-123', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'configurationDeployment').mockResolvedValue(
        errResponse(502),
      );
      await expect(
        service.getDeploymentConfiguration('statgpt', 'user-123', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getDeploymentLimits', () => {
    const mockLimits = {
      dayTokenStats: { total: 10000, used: 4000 },
      dayCostStats: { total: 100, used: 10 },
    };

    it('returns limits from upstream', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      const result = await service.getDeploymentLimits('gpt-4o', 'token');
      expect(result).toEqual(mockLimits);
    });

    it('forwards Authorization header to DIAL Core', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      await service.getDeploymentLimits('gpt-4o', 'my-token');
      expect(sdkClient.getDeploymentLimits).toHaveBeenCalledWith(
        'gpt-4o',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('does not use cache — two calls invoke upstream twice', async () => {
      const { service, sdkClient, cacheManager } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(okResponse(mockLimits));

      await service.getDeploymentLimits('gpt-4o', 'token');
      await service.getDeploymentLimits('gpt-4o', 'token');

      expect(sdkClient.getDeploymentLimits).toHaveBeenCalledTimes(2);
      expect(cacheManager.get).not.toHaveBeenCalledWith(
        expect.stringContaining('limits'),
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(errResponse(404));
      await expect(
        service.getDeploymentLimits('unknown', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(
        service.getDeploymentLimits('gpt-4o', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentLimits.mockResolvedValue(errResponse(502));
      await expect(
        service.getDeploymentLimits('gpt-4o', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
