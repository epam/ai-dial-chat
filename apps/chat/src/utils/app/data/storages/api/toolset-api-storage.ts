import {
  convertToolsetFromApi,
  convertToolsetModelToApi,
} from '@/src/utils/app/toolsets';
import {
  getMarketplaceEntityApiKey,
  parseEntityApiKey,
} from '@/src/utils/server/api';

import { ApiKeys } from '@/src/types/common';
import { ToolsetInfo, ToolsetModel } from '@/src/types/toolsets';

import { DEFAULT_VERSION } from '@/src/constants/publication';

import { ApiEntityStorage } from './api-entity-storage';

import { Toolset } from '@epam/ai-dial-shared';

export class ToolsetApiStorage extends ApiEntityStorage<
  ToolsetInfo,
  ToolsetModel,
  Toolset
> {
  mergeGetResult(info: ToolsetInfo, entity: Toolset): ToolsetModel {
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
    return parseEntityApiKey(key, {
      parseVersion: true,
      defaultVersion: DEFAULT_VERSION,
    });
  }
  getStorageKey(): ApiKeys {
    return ApiKeys.Toolsets;
  }
}
