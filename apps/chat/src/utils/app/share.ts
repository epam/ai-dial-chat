import { FeatureType } from '@/src/types/common';
import { SharingType } from '@/src/types/share';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';

import { RootState } from '@/src/store';
import { Entity, ShareEntity } from '@epam/ai-dial-shared';

export const isEntityExternal = (entity: ShareEntity) =>
  !!(entity.sharedWithMe || entity.publishedWithMe);

export const hasExternalParent = (
  state: RootState,
  folderId: string,
  featureType: FeatureType,
) => {
  if (!featureType) return false;

  if (featureType === FeatureType.Chat) {
    return ConversationsSelectors.hasExternalParent(state, folderId);
  } else if (featureType === FeatureType.Prompt) {
    return PromptsSelectors.hasExternalParent(state, folderId);
  }

  return FilesSelectors.hasExternalParent(state, folderId);
};

export const isEntityOrParentsExternal = (
  state: RootState,
  entity: Entity,
  featureType: FeatureType,
) => {
  return (
    isEntityExternal(entity) ||
    hasExternalParent(state, entity.folderId, featureType)
  );
};

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
