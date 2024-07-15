import { Entity, FeatureType, ShareEntity } from '@/src/types/common';
import { SharingType } from '@/src/types/share';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';

import { RootState } from '@/src/store';

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

export const isPublishVersionUnique = (type: SharingType) => {
  switch (type) {
    case SharingType.Conversation:
      return ConversationsSelectors.isPublishConversationVersionUnique;
    case SharingType.ConversationFolder:
      return ConversationsSelectors.isPublishFolderVersionUnique;
    case SharingType.Prompt:
      return PromptsSelectors.isPublishPromptVersionUnique;
    case SharingType.PromptFolder:
      return PromptsSelectors.isPublishFolderVersionUnique;
    default:
      throw new Error('unknown type');
  }
};

export const getAttachments = (type: SharingType) => {
  // TODO: get rid of it
  switch (type) {
    case SharingType.Conversation:
    case SharingType.ConversationFolder:
      return ConversationsSelectors.getAttachments;
    case SharingType.Prompt:
    case SharingType.PromptFolder:
      return () => [];
    default:
      throw new Error('unknown type');
  }
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
