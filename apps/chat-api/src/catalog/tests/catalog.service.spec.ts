import { BadGatewayException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationsService } from '../../applications/applications.service';
import type { ApplicationsResponseDto } from '../../applications/dto/application.dto';
import type { ModelsService } from '../../models/models.service';
import {
  CatalogFilterService,
  type CatalogFilter,
} from '../catalog-filter.service';
import { CatalogService } from '../catalog.service';
import type { CatalogItemDto } from '../dto/catalog-item.dto';

const mockModelsResponse = {
  data: [
    {
      id: 'gpt-4o',
      object: 'model',
      display_name: 'Zebra',
      capabilities: { chatCompletion: true, embeddings: false },
    },
    {
      id: 'claude',
      object: 'model',
      display_name: 'Alpha',
      capabilities: { chat_completion: true, embeddings: false },
    },
  ],
};
const mockAppsResponse: ApplicationsResponseDto = {
  data: [{ id: 'my-app', object: 'application', display_name: 'Beta App' }],
};

function makeService(
  overrides: {
    catalogCached?: CatalogItemDto[];
    filterResult?: CatalogItemDto[];
  } = {},
) {
  const store = new Map<string, unknown>();
  if (overrides.catalogCached) {
    store.set('catalog:list:user1', overrides.catalogCached);
  }

  const cacheManager = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  };

  const modelsService = {
    listModels: vi.fn().mockResolvedValue(mockModelsResponse),
  } as unknown as ModelsService;

  const applicationsService = {
    listApplications: vi.fn().mockResolvedValue(mockAppsResponse),
  } as unknown as ApplicationsService;

  const catalogFilterService = new CatalogFilterService();
  if (overrides.filterResult !== undefined) {
    vi.spyOn(catalogFilterService, 'apply').mockReturnValue(
      overrides.filterResult,
    );
  }

  const service = new CatalogService(
    modelsService,
    applicationsService,
    cacheManager as never,
    catalogFilterService,
  );

  return { service, modelsService, applicationsService, cacheManager };
}

describe('CatalogService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listCatalogItems', () => {
    it('merges models and applications into a sorted list', async () => {
      const { service } = makeService();
      const result = await service.listCatalogItems('user1', 'token');
      expect(result.data.map((i) => i.displayName)).toEqual([
        'Alpha',
        'Beta App',
        'Zebra',
      ]);
    });

    it('includes total and filtered counts when no filter applied', async () => {
      const { service } = makeService();
      const result = await service.listCatalogItems('user1', 'token');
      expect(result.total).toBe(3);
      expect(result.filtered).toBe(3);
    });

    it('maps model capabilities from SDK camelCase to canonical snake_case keys', async () => {
      const { service } = makeService();
      const result = await service.listCatalogItems('user1', 'token');
      const model = result.data.find((i) => i.type === 'model');
      expect(model?.capabilities).toEqual({
        chat_completion: true,
        embeddings: false,
      });
    });

    it('does not set capabilities for application items', async () => {
      const { service } = makeService();
      const result = await service.listCatalogItems('user1', 'token');
      const app = result.data.find((i) => i.type === 'application');
      expect(app?.capabilities).toBeUndefined();
    });

    it('assigns correct type discriminator for models and applications', async () => {
      const { service } = makeService();
      const result = await service.listCatalogItems('user1', 'token');
      const types = Object.fromEntries(
        result.data.map((i) => [i.displayName, i.type]),
      );
      expect(types).toEqual({
        Alpha: 'model',
        'Beta App': 'application',
        Zebra: 'model',
      });
    });

    it('sorts case-insensitively by displayName', async () => {
      const { service, modelsService, applicationsService } = makeService();
      vi.mocked(modelsService.listModels).mockResolvedValue({
        data: [{ id: 'z', object: 'model', display_name: 'zebra' }],
      });
      vi.mocked(applicationsService.listApplications).mockResolvedValue({
        data: [
          { id: 'a', object: 'application', display_name: 'Alpha' },
          { id: 'b', object: 'application', display_name: 'beta' },
        ],
      });
      const result = await service.listCatalogItems('user1', 'token');
      expect(result.data.map((i) => i.id)).toEqual(['a', 'b', 'z']);
    });

    it('uses id as tiebreaker when displayNames are equal', async () => {
      const { service, modelsService, applicationsService } = makeService();
      vi.mocked(modelsService.listModels).mockResolvedValue({
        data: [{ id: 'zzz', object: 'model', display_name: 'Same' }],
      });
      vi.mocked(applicationsService.listApplications).mockResolvedValue({
        data: [{ id: 'aaa', object: 'application', display_name: 'Same' }],
      });
      const result = await service.listCatalogItems('user1', 'token');
      expect(result.data.map((i) => i.id)).toEqual(['aaa', 'zzz']);
    });

    it('falls back to id when displayName is absent', async () => {
      const { service, modelsService } = makeService();
      vi.mocked(modelsService.listModels).mockResolvedValue({
        data: [{ id: 'no-name', object: 'model' }],
      });
      const result = await service.listCatalogItems('user1', 'token');
      expect(result.data.find((i) => i.id === 'no-name')?.displayName).toBe(
        'no-name',
      );
    });

    it('returns models only when applications list is empty', async () => {
      const { service, applicationsService } = makeService();
      vi.mocked(applicationsService.listApplications).mockResolvedValue({
        data: [],
      });
      const result = await service.listCatalogItems('user1', 'token');
      expect(result.data.every((i) => i.type === 'model')).toBe(true);
    });

    it('rethrows when modelsService throws', async () => {
      const { service, modelsService } = makeService();
      vi.mocked(modelsService.listModels).mockRejectedValue(
        new BadGatewayException(),
      );
      await expect(service.listCatalogItems('user1', 'token')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('rethrows when applicationsService throws', async () => {
      const { service, applicationsService } = makeService();
      vi.mocked(applicationsService.listApplications).mockRejectedValue(
        new BadGatewayException(),
      );
      await expect(service.listCatalogItems('user1', 'token')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('does not call cacheManager.set when fetch throws', async () => {
      const { service, modelsService, cacheManager } = makeService();
      vi.mocked(modelsService.listModels).mockRejectedValue(
        new BadGatewayException(),
      );
      await expect(
        service.listCatalogItems('user1', 'token'),
      ).rejects.toThrow();
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('returns cached items without calling upstream services', async () => {
      const cached: CatalogItemDto[] = [
        { id: 'cached', displayName: 'Cached', type: 'model' as const },
      ];
      const { service, modelsService, applicationsService } = makeService({
        catalogCached: cached,
      });
      const result = await service.listCatalogItems('user1', 'token');
      expect(result.data).toEqual(cached);
      expect(modelsService.listModels).not.toHaveBeenCalled();
      expect(applicationsService.listApplications).not.toHaveBeenCalled();
    });

    it('applies capabilities filter after cache hit', async () => {
      const chatModel: CatalogItemDto = {
        id: 'gpt',
        displayName: 'GPT',
        type: 'model',
        capabilities: { chat_completion: true, embeddings: false },
      };
      const embeddingModel: CatalogItemDto = {
        id: 'ada',
        displayName: 'ADA',
        type: 'model',
        capabilities: { chat_completion: false, embeddings: true },
      };
      const app: CatalogItemDto = {
        id: 'app',
        displayName: 'App',
        type: 'application',
      };
      const { service } = makeService({
        catalogCached: [chatModel, embeddingModel, app],
      });
      const filter: CatalogFilter = {
        capabilities: { chat_completion: true, embeddings: false },
      };
      const result = await service.listCatalogItems('user1', 'token', filter);
      expect(result.data).toEqual([chatModel, app]);
      expect(result.total).toBe(3);
      expect(result.filtered).toBe(2);
    });

    it('returns empty data with total>0 when all items filtered out', async () => {
      const cached: CatalogItemDto[] = [
        {
          id: 'm1',
          displayName: 'M1',
          type: 'model',
          capabilities: { chat_completion: false },
        },
      ];
      const { service } = makeService({
        catalogCached: cached,
        filterResult: [],
      });
      const result = await service.listCatalogItems('user1', 'token', {
        capabilities: { chat_completion: true },
      });
      expect(result.data).toEqual([]);
      expect(result.total).toBe(1);
      expect(result.filtered).toBe(0);
    });

    it('caches sorted items array under per-user key', async () => {
      const { service, cacheManager } = makeService();
      await service.listCatalogItems('user1', 'token');
      expect(cacheManager.set).toHaveBeenCalledWith(
        'catalog:list:user1',
        expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String) }),
        ]),
        30000,
      );
    });
  });
});
