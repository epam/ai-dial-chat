import { BackendResourceType, FeatureType } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';

import { ApiKeys } from '../server/api';

export class EnumMapper {
  public static getFolderTypeByApiKey = (key: ApiKeys): FolderType => {
    switch (key) {
      case ApiKeys.Conversations:
        return FolderType.Chat;
      case ApiKeys.Prompts:
        return FolderType.Prompt;
      case ApiKeys.Files:
      default:
        return FolderType.File;
    }
  };

  public static getApiKeyByFeatureType = (featureType: FeatureType) => {
    switch (featureType) {
      case FeatureType.Prompt:
        return ApiKeys.Prompts;
      case FeatureType.Chat:
        return ApiKeys.Conversations;
      default:
        return ApiKeys.Files;
    }
  };

  public static getBackendResourceTypeByFeatureType = (
    entityType: FeatureType,
  ) => {
    switch (entityType) {
      case FeatureType.Chat:
        return BackendResourceType.CONVERSATION;
      case FeatureType.Prompt:
        return BackendResourceType.PROMPT;
      case FeatureType.File:
      default:
        return BackendResourceType.FILE;
    }
  };
}
