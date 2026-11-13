import type { PublishRuleDto } from '@epam/ai-dial-chat-api-client';
import { PublishRuleDtoFunctionEnum } from '@epam/ai-dial-chat-api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishApi } from '../api-client';
import {
  CatalogPublishEntityType,
  publishCatalogEntity,
  unpublishCatalogEntity,
} from '../publish.api';

vi.mock('../api-client', () => ({
  publishApi: {
    publishCatalogEntity: vi.fn(),
    unpublishCatalogEntity: vi.fn(),
    getCatalogPublishHistory: vi.fn(),
  },
}));

const unpublishResult = {
  entityId: 'tool-abc123',
  entityType: CatalogPublishEntityType.Toolset,
  folderPath: 'Organization/Data Science',
  version: '1.2.0',
  requestedAt: '2026-08-13T10:00:00.000Z',
  requestedBy: 'user@example.com',
};

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

describe('unpublishCatalogEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the entity type, id, and body to the generated client', async () => {
    vi.mocked(publishApi.unpublishCatalogEntity).mockResolvedValue(
      unpublishResult,
    );

    await unpublishCatalogEntity(
      CatalogPublishEntityType.Toolset,
      'tool-abc123',
      { folderPath: 'Organization/Data Science', version: '1.2.0' },
    );

    expect(publishApi.unpublishCatalogEntity).toHaveBeenCalledWith({
      entityType: CatalogPublishEntityType.Toolset,
      entityId: 'tool-abc123',
      unpublishCatalogEntityDto: {
        folderPath: 'Organization/Data Science',
        version: '1.2.0',
      },
    });
  });

  /* A prompt or skill has no version, and the backend recovers or empties it. */
  it('omits version entirely when the caller does not supply one', async () => {
    vi.mocked(publishApi.unpublishCatalogEntity).mockResolvedValue({
      ...unpublishResult,
      version: '',
    });

    await unpublishCatalogEntity(CatalogPublishEntityType.Prompt, 'Work/AI/p', {
      folderPath: 'Organization/Prompts',
    });

    expect(publishApi.unpublishCatalogEntity).toHaveBeenCalledWith({
      entityType: CatalogPublishEntityType.Prompt,
      entityId: 'Work/AI/p',
      unpublishCatalogEntityDto: { folderPath: 'Organization/Prompts' },
    });
  });

  it('never sends a rules array', async () => {
    vi.mocked(publishApi.unpublishCatalogEntity).mockResolvedValue(
      unpublishResult,
    );

    await unpublishCatalogEntity(
      CatalogPublishEntityType.Toolset,
      'tool-abc123',
      { folderPath: 'Organization' },
    );

    const [call] = vi.mocked(publishApi.unpublishCatalogEntity).mock.calls;
    expect(call[0].unpublishCatalogEntityDto).not.toHaveProperty('rules');
  });

  it('resolves with the request-shaped result, not a publish-shaped one', async () => {
    vi.mocked(publishApi.unpublishCatalogEntity).mockResolvedValue(
      unpublishResult,
    );

    const result = await unpublishCatalogEntity(
      CatalogPublishEntityType.Toolset,
      'tool-abc123',
      { folderPath: 'Organization/Data Science' },
    );

    expect(result.requestedAt).toBe('2026-08-13T10:00:00.000Z');
    expect(result).not.toHaveProperty('publishedAt');
  });
});
