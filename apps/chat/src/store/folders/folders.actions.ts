import { FeatureType } from '@/src/types/common';

import { ConversationsActions } from '../conversations/conversations.reducers';
import { PromptsActions } from '../prompts/prompts.reducers';

export const toggleChosenFolder = (featureType: FeatureType) => {
  switch (featureType) {
    case FeatureType.Chat:
      return ConversationsActions.toggleChosenFolder;
    case FeatureType.Prompt:
      return PromptsActions.toggleChosenFolder;
    default:
      return () => false;
  }
};
