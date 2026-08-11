import type {
  PublishCatalogEntityDto,
  PublishHistoryEntryDto,
  PublishResultDto,
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

export const getCatalogPublishHistory = (
  entityType: CatalogPublishEntityType,
  entityId: string,
): Promise<PublishHistoryEntryDto[]> =>
  publishApi.getCatalogPublishHistory({ entityType, entityId });
