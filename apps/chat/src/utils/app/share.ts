import { FeatureType } from '@/src/types/common';
import { SharingType } from '@/src/types/share';

export const getShareType = (
  featureType?: FeatureType,
  isFolder?: boolean,
): SharingType | undefined => {
  if (!featureType) {
    return undefined;
  }

  if (isFolder) {
    switch (featureType) {
      case FeatureType.Chat:
        return SharingType.ConversationFolder;
      case FeatureType.Prompt:
        return SharingType.PromptFolder;
      default:
        return undefined;
    }
  } else {
    switch (featureType) {
      case FeatureType.Chat:
        return SharingType.Conversation;
      case FeatureType.Prompt:
        return SharingType.Prompt;
      default:
        return undefined;
    }
  }
};
