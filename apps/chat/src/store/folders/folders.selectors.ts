import { FeatureType } from '@/src/types/common';

import { ConversationsSelectors } from '../conversations/conversations.reducers';
import { PromptsSelectors } from '../prompts/prompts.reducers';

export const selectIsSelectMode = (featureType: FeatureType) => {
  switch (featureType) {
    case FeatureType.Chat:
      return ConversationsSelectors.selectIsSelectMode;
    case FeatureType.Prompt:
      return PromptsSelectors.selectIsSelectMode;
    default:
      return () => false;
  }
};

export const selectChosenFolderIds = (featureType: FeatureType) => {
  switch (featureType) {
    case FeatureType.Chat:
      return ConversationsSelectors.selectChosenFolderIds;
    case FeatureType.Prompt:
      return PromptsSelectors.selectChosenFolderIds;
    default:
      return () => [];
  }
};

export const selectChosenEntityIds = (featureType: FeatureType) => {
  switch (featureType) {
    case FeatureType.Chat:
      return ConversationsSelectors.selectChosenConversationIds;
    case FeatureType.Prompt:
      return PromptsSelectors.selectChosenPromptIds;
    default:
      return () => [];
  }
};
