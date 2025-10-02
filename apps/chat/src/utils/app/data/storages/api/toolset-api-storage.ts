import {
  convertToolsetFromApi,
  convertToolsetModelToApi,
} from '@/src/utils/app/toolsets';
import {
  getMarketplaceEntityApiKey,
  parseMarketplaceEntityApiKey,
} from '@/src/utils/server/api';

import { ApiKeys } from '@/src/types/common';
import { ToolsetInfo, ToolsetModel } from '@/src/types/toolsets';

import { ApiEntityStorage } from './api-entity-storage';

import { Entity, Toolset } from '@epam/ai-dial-shared';

export class ToolsetApiStorage extends ApiEntityStorage<
  ToolsetInfo,
  ToolsetModel,
  Toolset
> {
  mergeGetResult(info: Entity, entity: Toolset): ToolsetModel {
    return {
      ...info,
      ...convertToolsetFromApi(entity),
    };
  }

  cleanUpEntity(toolset: ToolsetModel): Toolset {
    return convertToolsetModelToApi(toolset);
  }
  getEntityKey(info: ToolsetModel): string {
    return getMarketplaceEntityApiKey(info);
  }
  parseEntityKey(key: string): Omit<ToolsetInfo, 'folderId' | 'id'> {
    return parseMarketplaceEntityApiKey(key);
  }
  getStorageKey(): ApiKeys {
    return ApiKeys.Toolsets;
  }
}
