import type { CatalogItem } from '@epam/ai-dial-catalog';
import type {
  ApplicationSchemaSummaryDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import {
  findDeploymentByIdOrReference,
  getPublicCatalogEntityFolderPath,
  isPublicCatalogEntityId,
  mapPublishHistoryEntryDto,
  toPublishEntityType,
  toPublishRuleDto,
  findSchemaDisplayName,
} from '@epam/ai-dial-chat-hooks';
import type {
  PublicationRule,
  PublishHistoryEntry,
} from '@epam/ai-dial-publish-panel';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getPublishRules } from '../../server-api/publish-rules.api';
import {
  getCatalogPublishHistory,
  getCatalogUnpublishAccess,
  publishCatalogEntity,
  unpublishCatalogEntity,
} from '../../server-api/publish.api';
import { EntityOperation } from '../../types/entity-notification';
import { resolveCatalogItemEntity } from '../../utils/entity-notification';
import { getPublishFolderLabel } from '../../utils/publish';
import type { useOperationNotification } from '../useOperationNotification';

interface UseCatalogPublishingParams {
  deployments: DeploymentItemDto[];
  /** Application schemas, used to name a schema app by its schema in notifications. */
  schemas: ApplicationSchemaSummaryDto[];
  rememberPublishFolder: (folderPath: string[]) => void;
  notifyOperationSuccess: ReturnType<
    typeof useOperationNotification
  >['notifyOperationSuccess'];
  showPublishError: (error: unknown, operation?: EntityOperation) => void;
  /** Whether the signed-in user is an administrator. */
  isAdmin: boolean;
}

interface UseCatalogPublishingResult {
  getPublishHistory: (item: CatalogItem) => Promise<PublishHistoryEntry[]>;
  handlePublish: (
    item: CatalogItem,
    folderPath: string[],
    rules: PublicationRule[],
    author: string,
    publishCredentials: boolean,
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
  isUnpublishVisible: (item: CatalogItem) => boolean;
}

/**
 * Owns the catalog's publish/unpublish flow: publish history lookup, the
 * publish/unpublish mutations and their success/error notifications, and
 * existing-rule lookup for the publish panel.
 */
export const useCatalogPublishing = ({
  deployments,
  schemas,
  rememberPublishFolder,
  notifyOperationSuccess,
  showPublishError,
  isAdmin,
}: UseCatalogPublishingParams): UseCatalogPublishingResult => {
  const { t } = useTranslation();

  /*
   * Publish and Unpublish act on two different items, and each is offered
   * only on the one it applies to ([#8691](https://github.com/epam/ai-dial-chat/issues/8691), where both landed on the wrong
   * side: the personal item offered nothing but Unpublish, and the public
   * copy offered nothing at all).
   *
   * Publish acts on the author's own source item, so it stays available there
   * for as long as the item is publishable — a second publish to another
   * folder, and a re-publish of the same folder after an edit, are both
   * ordinary operations, and a new version of an already-published deployment
   * has never been published at all.
   */
  const isPublishVisible = useCallback(
    (item: CatalogItem) =>
      Boolean(item.isMyApp) && toPublishEntityType(item.type) != null,
    [],
  );

  /*
   * Unpublish acts on the published copy under `public/`, never on the source
   * item it was published from — removing it is a request to delete that
   * copy, and the copy is the thing on screen. Offering it on the source
   * instead is what made it reachable for a personal item that was never
   * published, while leaving the public copy with no way to remove it.
   *
   * Who may ask — administrators and the copy's publisher ([#9180](https://github.com/epam/ai-dial-chat/issues/9180)) — is
   * not decided here but in `getPublishHistory` below, which resolves no
   * folder for anyone else so the panel hides the entry. Folder write access
   * was the earlier rule and said nothing about who published the copy:
   * every unrestricted folder passed it, offering Unpublish to everyone. The
   * backend refuses the request from anyone else regardless; this gate only
   * keeps an action the caller cannot complete off the menu.
   */
  const isUnpublishVisible = useCallback(
    (item: CatalogItem) =>
      isPublicCatalogEntityId(item.id) &&
      toPublishEntityType(item.type) != null,
    [],
  );

  /*
   * Load-bearing beyond the publish panel: this is the only source of the
   * folder list an unpublish request needs, and what makes the details
   * panel's Unpublish action visible at all. The [#7897](https://github.com/epam/ai-dial-chat/issues/7897) `503` this call
   * was stubbed out for was never Core being down: `PublishService` called
   * `.filter` on a `getPublications` response Core returns as an envelope,
   * and the resulting `TypeError` was reported as "DIAL Core is currently
   * unavailable". Fixed in `publication.util.ts`.
   */
  const getPublishHistory = useCallback(
    async (item: CatalogItem): Promise<PublishHistoryEntry[]> => {
      const entityType = toPublishEntityType(item.type);
      if (!entityType) return [];
      /*
       * A public copy's own id already states the one folder it is published
       * to, and asking Core is not merely wasteful but wrong: publications are
       * matched by the *source* url and listed from the caller's own bucket, so
       * a public id matches nothing (the author's publication records the
       * personal path; an administrator's bucket holds no record at all). That
       * empty history is what left the copy with no Unpublish. `publishedAt`
       * falls back to the copy's own timestamp — the details panel reads only
       * `folderPath` off these entries, and the publish panel, the one surface
       * that reads the rest, never opens for a public item.
       *
       * The entry exists only to give Unpublish its folder, so it is offered
       * only to someone who may unpublish the copy: an administrator outright,
       * anyone else when the backend confirms they published it. A failed
       * lookup rejects, which the panel treats as "hidden, retry next open".
       */
      if (isPublicCatalogEntityId(item.id)) {
        if (!isAdmin) {
          const { canUnpublish } = await getCatalogUnpublishAccess(
            entityType,
            item.id,
          );
          if (!canUnpublish) return [];
        }
        return [
          {
            version: item.version,
            publishedAt: item.updatedAt ?? Date.now(),
            folderPath: getPublicCatalogEntityFolderPath(item.id),
          },
        ];
      }
      const entries = await getCatalogPublishHistory(entityType, item.id);
      return entries.map(mapPublishHistoryEntryDto);
    },
    [isAdmin],
  );

  const handlePublish = useCallback(
    async (
      item: CatalogItem,
      folderPath: string[],
      rules: PublicationRule[],
      author: string,
      publishCredentials: boolean,
    ) => {
      const entityType = toPublishEntityType(item.type);
      if (!entityType) {
        throw new Error(`Entity type "${item.type}" is not publishable`);
      }
      const trimmedAuthor = author.trim();
      await publishCatalogEntity(entityType, item.id, {
        folderPath: folderPath.join('/'),
        ...(item.version ? { version: item.version } : {}),
        /* Omitted rather than sent empty, so the backend's own session-derived
           fallback applies instead of an empty "Hosted by". */
        ...(trimmedAuthor ? { author: trimmedAuthor } : {}),
        rules: rules.map(toPublishRuleDto),
        /* Omitted rather than sent as `false`, so a publish without shared
           access sends exactly the request it sent before this field. */
        ...(publishCredentials ? { publishCredentials: true } : {}),
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
      const deployment = findDeploymentByIdOrReference(deployments, item.id);
      notifyOperationSuccess(
        resolveCatalogItemEntity(item.type, deployment, schemas),
        EntityOperation.UnpublishRequested,
        {
          name: item.name,
          folder: getPublishFolderLabel(folderPath, t),
          type: findSchemaDisplayName(
            schemas,
            deployment?.applicationTypeSchemaId,
          ),
        },
      );
    },
    [deployments, notifyOperationSuccess, schemas, showPublishError, t],
  );

  const handlePublishSuccess = useCallback(
    (item: CatalogItem, folderPath: string[]) => {
      rememberPublishFolder(folderPath);
      const deployment = findDeploymentByIdOrReference(deployments, item.id);
      notifyOperationSuccess(
        resolveCatalogItemEntity(item.type, deployment, schemas),
        EntityOperation.PublishRequested,
        {
          name: item.name,
          folder: getPublishFolderLabel(folderPath, t),
          type: findSchemaDisplayName(
            schemas,
            deployment?.applicationTypeSchemaId,
          ),
        },
      );
    },
    [deployments, rememberPublishFolder, notifyOperationSuccess, schemas, t],
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
    isUnpublishVisible,
  };
};
