import type { CatalogItem } from '@epam/ai-dial-catalog';
import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishRules } from '../../../server-api/publish-rules.api';
import {
  CatalogPublishEntityType,
  getCatalogPublishHistory,
  publishCatalogEntity,
  unpublishCatalogEntity,
} from '../../../server-api/publish.api';
import { EntityOperation } from '../../../types/entity-notification';
import { useCatalogPublishing } from '../useCatalogPublishing';

vi.mock('../../../server-api/publish.api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  publishCatalogEntity: vi.fn(),
  unpublishCatalogEntity: vi.fn(),
  getCatalogPublishHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../server-api/publish-rules.api', () => ({
  getPublishRules: vi.fn().mockResolvedValue([]),
}));

const makeCatalogItem = (overrides?: Partial<CatalogItem>): CatalogItem => ({
  id: 'tool-abc123',
  type: CatalogEntityType.Toolset,
  name: 'My toolset',
  version: '1.2.0',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  isMyApp: true,
  ...overrides,
});

const renderPublishing = (
  overrides: Partial<Parameters<typeof useCatalogPublishing>[0]> = {},
) => {
  const rememberPublishFolder = vi.fn();
  const notifyOperationSuccess = vi.fn();
  const showPublishError = vi.fn();
  const view = renderHook(() =>
    useCatalogPublishing({
      deployments: [] as DeploymentItemDto[],
      rememberPublishFolder,
      notifyOperationSuccess,
      showPublishError,
      ...overrides,
    }),
  );
  return {
    ...view,
    rememberPublishFolder,
    notifyOperationSuccess,
    showPublishError,
  };
};

describe('useCatalogPublishing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('publish wiring', () => {
    it('calls publishCatalogEntity with the mapped entityType and folderPath', async () => {
      vi.mocked(publishCatalogEntity).mockResolvedValue({
        entityId: 'tool-abc123',
        entityType: 'toolset',
        folderPath: 'Organization/Data Science',
        version: '1.2.0',
        publishedAt: '2026-07-13T10:00:00.000Z',
        publishedBy: 'user@example.com',
      });
      const { result } = renderPublishing();

      await result.current.handlePublish(
        makeCatalogItem(),
        ['Organization', 'Data Science'],
        [],
      );

      expect(publishCatalogEntity).toHaveBeenCalledWith(
        'toolset',
        'tool-abc123',
        {
          folderPath: 'Organization/Data Science',
          version: '1.2.0',
          rules: [],
        },
      );
    });

    it('publishes an owned skill without sending a synthetic version', async () => {
      vi.mocked(publishCatalogEntity).mockResolvedValue({
        entityId: 'skills/my-bucket/analysis/revenue-skill',
        entityType: 'skill',
        folderPath: 'Organization/Data Science',
        version: '',
        publishedAt: '2026-07-13T10:00:00.000Z',
        publishedBy: 'user@example.com',
      });
      const { result } = renderPublishing();

      await result.current.handlePublish(
        makeCatalogItem({
          id: 'skills/my-bucket/analysis/revenue-skill',
          type: CatalogEntityType.Skill,
          version: '',
        }),
        ['Organization', 'Data Science'],
        [],
      );

      expect(publishCatalogEntity).toHaveBeenCalledWith(
        'skill',
        'skills/my-bucket/analysis/revenue-skill',
        {
          folderPath: 'Organization/Data Science',
          rules: [],
        },
      );
    });

    it.each([
      CatalogEntityType.Toolset,
      CatalogEntityType.Prompt,
      CatalogEntityType.Agent,
      CatalogEntityType.Model,
      CatalogEntityType.Skill,
    ])('reports a submitted publish request naming the %s kind', (type) => {
      const { result, notifyOperationSuccess } = renderPublishing();

      result.current.handlePublishSuccess(makeCatalogItem({ type }), [
        'Organization',
        'Data Science',
      ]);

      expect(notifyOperationSuccess).toHaveBeenCalledWith(
        expect.anything(),
        EntityOperation.PublishRequested,
        { name: 'My toolset', folder: 'Data Science' },
      );
    });

    it('forwards rules added in the panel to publishCatalogEntity', async () => {
      vi.mocked(publishCatalogEntity).mockResolvedValue({
        entityId: 'tool-abc123',
        entityType: 'toolset',
        folderPath: 'Organization/Data Science',
        version: '1.2.0',
        publishedAt: '2026-07-13T10:00:00.000Z',
        publishedBy: 'user@example.com',
      });
      const rules: PublicationRule[] = [
        {
          source: 'role',
          function: 'CONTAIN' as PublicationRule['function'],
          targets: ['engineering'],
        },
      ];
      const { result } = renderPublishing();

      await result.current.handlePublish(
        makeCatalogItem(),
        ['Organization', 'Data Science'],
        rules,
      );

      expect(publishCatalogEntity).toHaveBeenCalledWith(
        'toolset',
        'tool-abc123',
        {
          folderPath: 'Organization/Data Science',
          version: '1.2.0',
          rules: [
            { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
          ],
        },
      );
    });

    it('onFetchExistingRules forwards the joined folder path to getPublishRules', async () => {
      const { result } = renderPublishing();

      await result.current.handleFetchExistingRules([
        'Organization',
        'Data Science',
      ]);

      expect(vi.mocked(getPublishRules)).toHaveBeenCalledWith(
        'Organization/Data Science',
      );
    });

    it('propagates a publish API failure (e.g. 403) to the caller', async () => {
      vi.mocked(publishCatalogEntity).mockRejectedValue(new Error('Forbidden'));
      const { result } = renderPublishing();

      await expect(
        result.current.handlePublish(makeCatalogItem(), ['Organization'], []),
      ).rejects.toThrow('Forbidden');
    });

    it('fetches publish history from the endpoint and maps each entry', async () => {
      vi.mocked(getCatalogPublishHistory).mockResolvedValue([
        {
          entityId: 'tool-abc123',
          entityType: CatalogPublishEntityType.Toolset,
          folderPath: 'Organization/Data Science',
          version: '1.0',
          publishedAt: '2026-07-13T10:00:00.000Z',
          publishedBy: 'user@example.com',
        },
      ]);
      const { result } = renderPublishing();

      const history = await result.current.getPublishHistory(makeCatalogItem());

      expect(getCatalogPublishHistory).toHaveBeenCalledWith(
        CatalogPublishEntityType.Toolset,
        'tool-abc123',
      );
      expect(history).toEqual([
        {
          version: '1.0',
          publishedAt: Date.parse('2026-07-13T10:00:00.000Z'),
          folderPath: ['Organization', 'Data Science'],
        },
      ]);
    });

    it('shows Publish only for isMyApp items of a publishable type', () => {
      const { result } = renderPublishing();

      expect(result.current.isPublishVisible(makeCatalogItem())).toBe(true);
      expect(
        result.current.isPublishVisible(makeCatalogItem({ isMyApp: false })),
      ).toBe(false);
    });
  });

  describe('unpublish', () => {
    beforeEach(() => {
      vi.mocked(unpublishCatalogEntity).mockResolvedValue({
        entityId: 'tool-abc123',
        entityType: 'toolset',
        folderPath: 'Organization/Data Science',
        version: '1.2.0',
        requestedAt: '2026-08-13T10:00:00.000Z',
        requestedBy: 'user@example.com',
      });
    });

    it('requests unpublish with the mapped entity type, joined folder, and version', async () => {
      const { result } = renderPublishing();

      await result.current.handleUnpublish(makeCatalogItem(), [
        'Organization',
        'Data Science',
      ]);

      expect(unpublishCatalogEntity).toHaveBeenCalledWith(
        CatalogPublishEntityType.Toolset,
        'tool-abc123',
        { folderPath: 'Organization/Data Science', version: '1.2.0' },
      );
    });

    /* A prompt or skill carries no version, and the backend recovers or empties it. */
    it('omits version for an unversioned item', async () => {
      const { result } = renderPublishing();

      await result.current.handleUnpublish(
        makeCatalogItem({ type: CatalogEntityType.Prompt, version: undefined }),
        ['Organization'],
      );

      expect(unpublishCatalogEntity).toHaveBeenCalledWith(
        CatalogPublishEntityType.Prompt,
        'tool-abc123',
        { folderPath: 'Organization' },
      );
    });

    it('reports a submitted request naming the folder leaf, not a completed removal', async () => {
      const { result, notifyOperationSuccess } = renderPublishing();

      await result.current.handleUnpublish(makeCatalogItem(), [
        'Organization',
        'Data Science',
      ]);

      expect(notifyOperationSuccess).toHaveBeenCalledWith(
        expect.anything(),
        EntityOperation.UnpublishRequested,
        { name: 'My toolset', folder: 'Data Science' },
      );
    });

    it('raises no success notification when the request fails, notifying then rethrowing', async () => {
      vi.mocked(unpublishCatalogEntity).mockRejectedValue(
        new Error('Forbidden'),
      );
      const { result, notifyOperationSuccess, showPublishError } =
        renderPublishing();

      /*
       * Notified here, then rethrown so the panel's own rejection path runs
       * — matching `handlePublish`, which lets the error reach the lib.
       */
      await expect(
        result.current.handleUnpublish(makeCatalogItem(), ['Organization']),
      ).rejects.toThrow('Forbidden');

      expect(showPublishError).toHaveBeenCalledWith(
        expect.any(Error),
        EntityOperation.UnpublishRequested,
      );
      expect(notifyOperationSuccess).not.toHaveBeenCalled();
    });

    it('offers Unpublish (isPublishVisible) exactly where Publish is offered', () => {
      const { result } = renderPublishing();

      expect(result.current.isPublishVisible(makeCatalogItem())).toBe(true);
      expect(
        result.current.isPublishVisible(makeCatalogItem({ isMyApp: false })),
      ).toBe(false);
    });
  });
});
