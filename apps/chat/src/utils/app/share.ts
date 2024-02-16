import {
  BackendDataNodeType,
  BackendResourceType,
  Entity,
  FeatureType,
  ShareEntity,
} from '@/src/types/common';
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

export const isEntityExternal = (entity: ShareEntity) =>
  !!(entity.sharedWithMe || entity.publishedWithMe);

// TODO: get rid of this utility and use from selectors
export const hasExternalParent = (
  state: RootState,
  folderId: string,
  featureType: FeatureType,
) => {
  if (!featureType) return false;

  return featureType === FeatureType.Chat
    ? ConversationsSelectors.hasExternalParent(state, folderId)
    : PromptsSelectors.hasExternalParent(state, folderId);
};

// TODO: get rid of this utility and use from selectors
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
  resourceType: BackendResourceType | undefined,
  nodeType: BackendDataNodeType | undefined,
): SharingType | undefined => {
  if (!resourceType || !nodeType) {
    return undefined;
  }

  if (nodeType === BackendDataNodeType.FOLDER) {
    switch (resourceType) {
      case BackendResourceType.CONVERSATION:
        return SharingType.ConversationFolder;
      case BackendResourceType.PROMPT:
        return SharingType.PromptFolder;
      default:
        return undefined;
    }
  } else {
    switch (resourceType) {
      case BackendResourceType.CONVERSATION:
        return SharingType.Conversation;
      case BackendResourceType.PROMPT:
        return SharingType.Prompt;
      default:
        return undefined;
    }
  }
};
