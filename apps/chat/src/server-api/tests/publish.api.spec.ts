import type { PublishRuleDto } from '@epam/ai-dial-chat-api-client';
import { PublishRuleDtoFunctionEnum } from '@epam/ai-dial-chat-api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishApi } from '../api-client';
import { CatalogPublishEntityType, publishCatalogEntity } from '../publish.api';

vi.mock('../api-client', () => ({
  publishApi: {
    publishCatalogEntity: vi.fn(),
    getCatalogPublishHistory: vi.fn(),
  },
}));

describe('publish API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the rules-carrying body to the generated client', async () => {
    const rules: PublishRuleDto[] = [
      {
        source: 'roles',
        function: PublishRuleDtoFunctionEnum.Contain,
        targets: ['engineering', 'support'],
      },
    ];
    vi.mocked(publishApi.publishCatalogEntity).mockResolvedValue({
      entityId: 'tool-abc123',
      entityType: CatalogPublishEntityType.Toolset,
      folderPath: 'Organization/Data Science',
      version: '1.2.0',
      publishedAt: '2026-07-13T10:00:00.000Z',
      publishedBy: 'user@example.com',
    });

    await publishCatalogEntity(
      CatalogPublishEntityType.Toolset,
      'tool-abc123',
      { folderPath: 'Organization/Data Science', version: '1.2.0', rules },
    );

    expect(publishApi.publishCatalogEntity).toHaveBeenCalledWith({
      entityType: CatalogPublishEntityType.Toolset,
      entityId: 'tool-abc123',
      publishCatalogEntityDto: {
        folderPath: 'Organization/Data Science',
        version: '1.2.0',
        rules,
      },
    });
  });

  it('sends an empty rules array when no rules were added', async () => {
    vi.mocked(publishApi.publishCatalogEntity).mockResolvedValue({
      entityId: 'tool-abc123',
      entityType: CatalogPublishEntityType.Toolset,
      folderPath: 'Organization',
      version: '1.2.0',
      publishedAt: '2026-07-13T10:00:00.000Z',
      publishedBy: 'user@example.com',
    });

    await publishCatalogEntity(
      CatalogPublishEntityType.Toolset,
      'tool-abc123',
      {
        folderPath: 'Organization',
        version: '1.2.0',
        rules: [],
      },
    );

    expect(publishApi.publishCatalogEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        publishCatalogEntityDto: expect.objectContaining({ rules: [] }),
      }),
    );
  });
});
