import type {
  PublishCatalogEntityDto,
  PublishHistoryEntryDto,
  PublishResultDto,
  UnpublishCatalogEntityDto,
  UnpublishResultDto,
} from '@epam/ai-dial-chat-api-client';
import { PublishCatalogEntityEntityTypeEnum } from '@epam/ai-dial-chat-api-client';
import { publishApi } from './api-client';

/** Catalog entity kinds that can be published. */
export type CatalogPublishEntityType = PublishCatalogEntityEntityTypeEnum;
export const CatalogPublishEntityType = PublishCatalogEntityEntityTypeEnum;

export const publishCatalogEntity = (
  entityType: CatalogPublishEntityType,
  entityId: string,
  body: PublishCatalogEntityDto,
): Promise<PublishResultDto> =>
  publishApi.publishCatalogEntity({
    entityType,
    entityId,
    publishCatalogEntityDto: body,
  });

/**
 * Submits a removal request for one already-published folder of a catalog
 * entity. The removal takes effect only after an administrator approves it, so
 * callers must report a pending request rather than a completed removal.
 */
export const unpublishCatalogEntity = (
  entityType: CatalogPublishEntityType,
  entityId: string,
  body: UnpublishCatalogEntityDto,
): Promise<UnpublishResultDto> =>
  publishApi.unpublishCatalogEntity({
    entityType,
    entityId,
    unpublishCatalogEntityDto: body,
  });

export const getCatalogPublishHistory = (
  entityType: CatalogPublishEntityType,
  entityId: string,
): Promise<PublishHistoryEntryDto[]> =>
  publishApi.getCatalogPublishHistory({ entityType, entityId });
