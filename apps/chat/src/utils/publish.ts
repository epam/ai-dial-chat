import { CatalogEntityType, PublishHistoryEntry } from '@epam/ai-dial-catalog';
import type { PublishHistoryEntryDto } from '@epam/chat-api-client';
import { CatalogPublishEntityType } from '../server-api/publish.api';

const PUBLISHABLE_ENTITY_TYPES: Partial<
  Record<CatalogEntityType, CatalogPublishEntityType>
> = {
  [CatalogEntityType.Model]: CatalogPublishEntityType.Model,
  [CatalogEntityType.Toolset]: CatalogPublishEntityType.Toolset,
  [CatalogEntityType.Application]: CatalogPublishEntityType.Application,
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
  publishedBy: dto.publishedBy,
  folderPath: dto.folderPath.split('/').filter(Boolean),
});
