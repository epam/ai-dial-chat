import { ApiKeys, BackendResourceType, FeatureType } from '@/src/types/common';
import { SharingType } from '@/src/types/share';

export class EnumMapper {
  public static getFolderTypeByApiKey = (key: ApiKeys): FeatureType => {
    switch (key) {
      case ApiKeys.Conversations:
        return FeatureType.Chat;
      case ApiKeys.Prompts:
        return FeatureType.Prompt;
      case ApiKeys.Files:
      default:
        return FeatureType.File;
    }
  };

  public static getApiKeyByFeatureType = (featureType: FeatureType) => {
    switch (featureType) {
      case FeatureType.Prompt:
        return ApiKeys.Prompts;
      case FeatureType.Chat:
        return ApiKeys.Conversations;
      case FeatureType.Application:
        return ApiKeys.Applications;
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
      case ApiKeys.Applications:
        return FeatureType.Application;
      case ApiKeys.Files:
      default:
        return FeatureType.File;
    }
  };

  public static getFeatureTypeBySharingType = (sharingType: SharingType) => {
    switch (sharingType) {
      case SharingType.Prompt:
      case SharingType.PromptFolder:
        return FeatureType.Prompt;
      case SharingType.Conversation:
      case SharingType.ConversationFolder:
        return FeatureType.Chat;
      case SharingType.Application:
        return FeatureType.Application;
      case SharingType.File:
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
      case FeatureType.Application:
        return BackendResourceType.APPLICATION;
      case FeatureType.File:
      default:
        return BackendResourceType.FILE;
    }
  };
}
