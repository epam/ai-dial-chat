import type {
  PublishApi,
  PublishCatalogEntityDto,
  PublishHistoryEntryDto,
  PublishResultDto,
  PublishRuleDto,
  UnpublishCatalogEntityDto,
  UnpublishResultDto,
} from '@epam/ai-dial-chat-api-client';
import type {
  PublicationRule,
  PublicationRuleFunction,
} from '@epam/ai-dial-publish-panel';
import type { CatalogPublishEntityType } from './publish';

/**
 * Converts a `PublicationRule` (publish-panel lib model) to the generated
 * client's `PublishRuleDto` shape. The two differ only in how the comparison
 * function is typed, so the value passes through unchanged.
 */
export const toPublishRuleDto = (rule: PublicationRule): PublishRuleDto => ({
  source: rule.source,
  targets: rule.targets,
  function: rule.function as unknown as PublishRuleDto['function'],
});

/** The DIAL publish API surface produced by {@link createPublishApiClient}. */
export interface PublishApiClient {
  /** Submits a publication request for one catalog entity into `folderPath`. */
  publishCatalogEntity: (
    entityType: CatalogPublishEntityType,
    entityId: string,
    body: PublishCatalogEntityDto,
  ) => Promise<PublishResultDto>;
  /**
   * Submits a removal request for one already-published folder of a catalog
   * entity. The removal takes effect only after an administrator approves it,
   * so callers must report a pending request rather than a completed removal.
   */
  unpublishCatalogEntity: (
    entityType: CatalogPublishEntityType,
    entityId: string,
    body: UnpublishCatalogEntityDto,
  ) => Promise<UnpublishResultDto>;
  /** Reads the folders one catalog entity is already published to. */
  getCatalogPublishHistory: (
    entityType: CatalogPublishEntityType,
    entityId: string,
  ) => Promise<PublishHistoryEntryDto[]>;
  /** Reads a destination folder's already-configured access rules. */
  getPublishRules: (folderPath: string) => Promise<PublicationRule[]>;
}

/**
 * Wraps the generated `PublishApi` in the positional-argument surface the
 * catalog and conversation publish flows call, so each host app re-exports one
 * client instead of re-declaring the same four wrappers. Mirrors
 * {@link createFilesApiClient}.
 */
export const createPublishApiClient = (
  publishApi: PublishApi,
): PublishApiClient => ({
  publishCatalogEntity: (entityType, entityId, body) =>
    publishApi.publishCatalogEntity({
      entityType,
      entityId,
      publishCatalogEntityDto: body,
    }),
  unpublishCatalogEntity: (entityType, entityId, body) =>
    publishApi.unpublishCatalogEntity({
      entityType,
      entityId,
      unpublishCatalogEntityDto: body,
    }),
  getCatalogPublishHistory: (entityType, entityId) =>
    publishApi.getCatalogPublishHistory({ entityType, entityId }),
  getPublishRules: async (folderPath) => {
    const response = await publishApi.getPublishRules({ folderPath });
    return response.rules.map(({ function: ruleFunction, ...rule }) => ({
      ...rule,
      function: ruleFunction as unknown as PublicationRuleFunction,
    }));
  },
});
