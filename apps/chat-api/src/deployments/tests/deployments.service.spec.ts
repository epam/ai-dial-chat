import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeploymentsService } from '../deployments.service';
import type { DeploymentItemDto } from '../dto/deployment-item.dto';

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

function makeService(overrides: { cached?: DeploymentItemDto[] } = {}) {
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
      data: {
        deployments: [mockModel, mockApplication, mockToolset],
      },
    }),
  };

  const configService = {
    get: vi.fn().mockReturnValue('http://dial-core'),
  };

  const service = new DeploymentsService(
    configService as never,
    cacheManager as never,
  );
  (service as unknown as { client: typeof sdkClient }).client = sdkClient;

  return { service, sdkClient, cacheManager };
}

describe('DeploymentsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listDeployments', () => {
    it('maps model, application, and toolset correctly', async () => {
      const { service } = makeService();
      const result = await service.listDeployments('user1', 'token');
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
        data: { deployments: [mockModel, mockNoId] },
      });
      const result = await service.listDeployments('user1', 'token');
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].id).toBe('gpt-4o');
    });

    it('falls back displayName to id when display_name is absent', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: false,
        response: { status: 200 },
        data: { deployments: [mockNoDisplayName] },
      });
      const result = await service.listDeployments('user1', 'token');
      expect(result.deployments[0].displayName).toBe('no-name');
    });

    it('returns cached value without calling SDK on cache hit', async () => {
      const cached: DeploymentItemDto[] = [
        { id: 'cached', displayName: 'Cached', type: 'model' },
      ];
      const { service, sdkClient } = makeService({ cached });
      const result = await service.listDeployments('user1', 'token');
      expect(result.deployments).toEqual(cached);
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
          interfaces: ['embeddings'],
        },
        { id: 'no-iface', displayName: 'None', type: 'model' },
      ];
      const { service } = makeService({ cached });
      const result = await service.listDeployments('user1', 'token', ['chat']);
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].id).toBe('chat-model');
    });

    it('throws BadGatewayException when DIAL Core returns non-2xx', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.getDeploymentsByInterfaceType.mockResolvedValue({
        error: true,
        response: { status: 502 },
        data: undefined,
      });
      await expect(service.listDeployments('user1', 'token')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException when DIAL Core is unreachable', async () => {
      const { service, sdkClient } = makeService();
      const abortError = new Error('fetch failed');
      abortError.name = 'AbortError';
      sdkClient.getDeploymentsByInterfaceType.mockRejectedValue(abortError);
      await expect(service.listDeployments('user1', 'token')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
