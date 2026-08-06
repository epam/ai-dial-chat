import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import type {
  PublishCatalogEntityDto,
  PublishHistoryEntryDto,
  PublishResultDto,
} from '@epam/chat-api-client';
import { PublishCatalogEntityEntityTypeEnum } from '@epam/chat-api-client';
import { publishApi } from './api-client';

/** Catalog entity kinds that can be published. */
export type CatalogPublishEntityType = PublishCatalogEntityEntityTypeEnum;
export const CatalogPublishEntityType = PublishCatalogEntityEntityTypeEnum;

export const publishCatalogEntity = (
  entityType: CatalogPublishEntityType,
  entityId: string,
  body: Omit<PublishCatalogEntityDto, 'rules'> & { rules: PublicationRule[] },
): Promise<PublishResultDto> =>
  publishApi.publishCatalogEntity({
    entityType,
    entityId,
    publishCatalogEntityDto: {
      ...body,
      rules: body.rules.map(({ source, function: fn, targets }) => ({
        source,
        _function: fn,
        targets,
      })),
    },
  });

export const getCatalogPublishHistory = (
  entityType: CatalogPublishEntityType,
  entityId: string,
): Promise<PublishHistoryEntryDto[]> =>
  publishApi.getCatalogPublishHistory({ entityType, entityId });
