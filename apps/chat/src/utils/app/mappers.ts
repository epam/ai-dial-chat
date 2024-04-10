import { ApiKeys, BackendResourceType, FeatureType } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';

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
      case FeatureType.File:
      default:
        return ApiKeys.Files;
    }
  };

  public static getFeatureTypeByApiKey = (apiKey: ApiKeys) => {
    switch (apiKey) {
      case ApiKeys.Prompts:
        return FeatureType.Prompt;
      case ApiKeys.Conversations:
        return FeatureType.Chat;
      case ApiKeys.Files:
      default:
        return FeatureType.File;
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

export const getFolderTypeByFeatureType = (featureType: FeatureType) => {
  switch (featureType) {
    case FeatureType.Chat:
      return FolderType.Chat;
    case FeatureType.Prompt:
      return FolderType.Prompt;
    case FeatureType.File:
      return FolderType.File;
    default:
      return FolderType.Chat;
  }
};
