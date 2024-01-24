import { Entity, FeatureType, ShareEntity } from '@/src/types/common';
import { SharingType } from '@/src/types/share';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { RootState } from '@/src/store';

export const getShareActionByType = (type: SharingType) => {
  switch (type) {
    case SharingType.Conversation:
      return ConversationsActions.shareConversation;
    case SharingType.ConversationFolder:
      return ConversationsActions.shareFolder;
    case SharingType.Prompt:
      return PromptsActions.sharePrompt;
    case SharingType.PromptFolder:
      return PromptsActions.shareFolder;
    default:
      throw new Error('unknown type');
  }
};

export const getPublishActionByType = (type: SharingType) => {
  switch (type) {
    case SharingType.Conversation:
      return ConversationsActions.publishConversation;
    case SharingType.ConversationFolder:
      return ConversationsActions.publishFolder;
    case SharingType.Prompt:
      return PromptsActions.publishPrompt;
    case SharingType.PromptFolder:
      return PromptsActions.publishFolder;
    default:
      throw new Error('unknown type');
  }
};

export const getUnpublishActionByType = (type: SharingType) => {
  switch (type) {
    case SharingType.Conversation:
      return ConversationsActions.unpublishConversation;
    case SharingType.ConversationFolder:
      return ConversationsActions.unpublishFolder;
    case SharingType.Prompt:
      return PromptsActions.unpublishPrompt;
    case SharingType.PromptFolder:
      return PromptsActions.unpublishFolder;
    default:
      throw new Error('unknown type');
  }
};

export const isThisEntityExternal = (entity: ShareEntity) =>
  !!(entity.sharedWithMe || entity.publishedWithMe);

export const hasExternalParent = (
  state: RootState,
  folderId?: string,
  featureType?: FeatureType,
) => {
  if (!featureType || !folderId) return false;

  return featureType === FeatureType.Chat
    ? ConversationsSelectors.hasExternalParent(state, folderId)
    : PromptsSelectors.hasExternalParent(state, folderId);
};

export const isExternalEntity = (
  state: RootState,
  entity: Entity,
  featureType?: FeatureType,
) => {
  return (
    isThisEntityExternal(entity) ||
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
