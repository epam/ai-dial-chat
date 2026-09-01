import { PublishCatalogEntityEntityTypeEnum } from '@epam/ai-dial-chat-api-client';
import { createPublishApiClient } from '@epam/ai-dial-chat-hooks';
import { publishApi } from './api-client';

/**
 * Catalog entity kinds that can be published. Re-exported from the generated
 * enum rather than the lib's string-literal union so existing call sites keep
 * their `CatalogPublishEntityType.Skill`-style member access.
 */
export type CatalogPublishEntityType = PublishCatalogEntityEntityTypeEnum;
export const CatalogPublishEntityType = PublishCatalogEntityEntityTypeEnum;

const publishApiClient = createPublishApiClient(publishApi);

export const publishCatalogEntity = publishApiClient.publishCatalogEntity;
export const unpublishCatalogEntity = publishApiClient.unpublishCatalogEntity;
export const getCatalogPublishHistory =
  publishApiClient.getCatalogPublishHistory;
