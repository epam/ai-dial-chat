import type { CatalogItem } from '@epam/ai-dial-catalog';
import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import {
  findDeploymentByIdOrReference,
  mapPublishHistoryEntryDto,
  toPublishEntityType,
  toPublishRuleDto,
} from '@epam/ai-dial-chat-hooks';
import type {
  PublicationRule,
  PublishHistoryEntry,
} from '@epam/ai-dial-publish-panel';
import { useCallback } from 'react';
import { getPublishRules } from '../../server-api/publish-rules.api';
import {
  getCatalogPublishHistory,
  publishCatalogEntity,
  unpublishCatalogEntity,
} from '../../server-api/publish.api';
import { EntityOperation } from '../../types/entity-notification';
import { resolveCatalogItemEntity } from '../../utils/entity-notification';
import type { useOperationNotification } from '../useOperationNotification';

interface UseCatalogPublishingParams {
  deployments: DeploymentItemDto[];
  rememberPublishFolder: (folderPath: string[]) => void;
  notifyOperationSuccess: ReturnType<
    typeof useOperationNotification
  >['notifyOperationSuccess'];
  showPublishError: (error: unknown, operation?: EntityOperation) => void;
}

interface UseCatalogPublishingResult {
  getPublishHistory: (item: CatalogItem) => Promise<PublishHistoryEntry[]>;
  handlePublish: (
    item: CatalogItem,
    folderPath: string[],
    rules: PublicationRule[],
  ) => Promise<void>;
  handleUnpublish: (item: CatalogItem, folderPath: string[]) => Promise<void>;
  handlePublishSuccess: (item: CatalogItem, folderPath: string[]) => void;
  handlePublishError: (
    item: CatalogItem,
    folderPath: string[],
    error: unknown,
  ) => void;
  handleFetchExistingRules: (
    folderPath: string[],
  ) => Promise<PublicationRule[]>;
  isPublishVisible: (item: CatalogItem) => boolean;
}

/**
 * Owns the catalog's publish/unpublish flow: publish history lookup, the
 * publish/unpublish mutations and their success/error notifications, and
 * existing-rule lookup for the publish panel.
 */
export const useCatalogPublishing = ({
  deployments,
  rememberPublishFolder,
  notifyOperationSuccess,
  showPublishError,
}: UseCatalogPublishingParams): UseCatalogPublishingResult => {
  const isPublishVisible = useCallback(
    (item: CatalogItem) =>
      Boolean(item.isMyApp) && toPublishEntityType(item.type) != null,
    [],
  );

  /*
   * Load-bearing beyond the publish panel: this is the only source of the
   * folder list an unpublish request needs, and what makes the details
   * panel's Unpublish action visible at all. The GH #7897 `503` this call
   * was stubbed out for was never Core being down: `PublishService` called
   * `.filter` on a `getPublications` response Core returns as an envelope,
   * and the resulting `TypeError` was reported as "DIAL Core is currently
   * unavailable". Fixed in `publication.util.ts`.
   */
  const getPublishHistory = useCallback(async (item: CatalogItem) => {
    const entityType = toPublishEntityType(item.type);
    if (!entityType) return [];
    const entries = await getCatalogPublishHistory(entityType, item.id);
    return entries.map(mapPublishHistoryEntryDto);
  }, []);

  const handlePublish = useCallback(
    async (
      item: CatalogItem,
      folderPath: string[],
      rules: PublicationRule[],
    ) => {
      const entityType = toPublishEntityType(item.type);
      if (!entityType) {
        throw new Error(`Entity type "${item.type}" is not publishable`);
      }
      await publishCatalogEntity(entityType, item.id, {
        folderPath: folderPath.join('/'),
        ...(item.version ? { version: item.version } : {}),
        rules: rules.map(toPublishRuleDto),
      });
    },
    [],
  );

  const handleFetchExistingRules = useCallback(
    (folderPath: string[]) => getPublishRules(folderPath.join('/')),
    [],
  );

  /*
   * Reports a submitted request, never a completed removal: the published
   * copy survives until an administrator approves, so nothing here refreshes
   * the list or drops the folder from history.
   */
  const handleUnpublish = useCallback(
    async (item: CatalogItem, folderPath: string[]) => {
      const entityType = toPublishEntityType(item.type);
      if (!entityType) {
        throw new Error(`Entity type "${item.type}" is not publishable`);
      }
      try {
        await unpublishCatalogEntity(entityType, item.id, {
          folderPath: folderPath.join('/'),
          ...(item.version ? { version: item.version } : {}),
        });
      } catch (error) {
        /* Notified here, then rethrown so the panel's own rejection path runs
         * — matching `handlePublish`, which lets the error reach the lib. */
        showPublishError(error, EntityOperation.UnpublishRequested);
        throw error;
      }
      notifyOperationSuccess(
        resolveCatalogItemEntity(
          item.type,
          findDeploymentByIdOrReference(deployments, item.id),
        ),
        EntityOperation.UnpublishRequested,
        {
          name: item.name,
          folder: folderPath[folderPath.length - 1],
        },
      );
    },
    [deployments, notifyOperationSuccess, showPublishError],
  );

  const handlePublishSuccess = useCallback(
    (item: CatalogItem, folderPath: string[]) => {
      rememberPublishFolder(folderPath);
      notifyOperationSuccess(
        resolveCatalogItemEntity(
          item.type,
          findDeploymentByIdOrReference(deployments, item.id),
        ),
        EntityOperation.PublishRequested,
        {
          name: item.name,
          folder: folderPath[folderPath.length - 1],
        },
      );
    },
    [deployments, rememberPublishFolder, notifyOperationSuccess],
  );

  const handlePublishError = useCallback(
    (_item: CatalogItem, _folderPath: string[], error: unknown) =>
      showPublishError(error),
    [showPublishError],
  );

  return {
    getPublishHistory,
    handlePublish,
    handleUnpublish,
    handlePublishSuccess,
    handlePublishError,
    handleFetchExistingRules,
    isPublishVisible,
  };
};
