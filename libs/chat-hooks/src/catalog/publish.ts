import type {
  PublishConversationResultDto,
  PublishHistoryEntryDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { PublishHistoryEntry } from '@epam/ai-dial-publish-panel';

/**
 * The publish API's entity-type path param values. Re-declared as a plain
 * string-literal union rather than importing the generated
 * `PublishCatalogEntityEntityTypeEnum`, so this module has no dependency on
 * the app's own `server-api` layer.
 */
export type CatalogPublishEntityType =
  | 'model'
  | 'toolset'
  | 'application'
  | 'prompt'
  | 'skill';

const PUBLISHABLE_ENTITY_TYPES: Partial<
  Record<CatalogEntityType, CatalogPublishEntityType>
> = {
  [CatalogEntityType.Model]: 'model',
  [CatalogEntityType.Toolset]: 'toolset',
  [CatalogEntityType.Agent]: 'application',
  [CatalogEntityType.Prompt]: 'prompt',
  [CatalogEntityType.Skill]: 'skill',
};

/** Maps a catalog item's entity type to the publish API's entity-type path param, or `undefined` if that type is not publishable. */
export const toPublishEntityType = (
  type: CatalogEntityType,
): CatalogPublishEntityType | undefined => PUBLISHABLE_ENTITY_TYPES[type];

/** Maps a publish-history API response entry to the catalog lib's `PublishHistoryEntry` model. */
export const mapPublishHistoryEntryDto = (
  dto: PublishHistoryEntryDto,
): PublishHistoryEntry => ({
  version: dto.version,
  publishedAt: Date.parse(dto.publishedAt),
  folderPath: dto.folderPath.split('/').filter(Boolean),
});

/** Maps a conversation publish-history API response entry to the publish panel's `PublishHistoryEntry` model. */
export const mapPublishConversationResultDto = (
  dto: PublishConversationResultDto,
): PublishHistoryEntry => ({
  /* A conversation carries no version, so any entry for a folder already means
   * "published here" — see `usePublishFlow`. */
  publishedAt: Date.parse(dto.publishedAt),
  folderPath: dto.folderPath.split('/').filter(Boolean),
});
