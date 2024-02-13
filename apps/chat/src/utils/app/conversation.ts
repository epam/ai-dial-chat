import { prepareEntityName } from '@/src/utils/app/common';

import {
  Conversation,
  ConversationInfo,
  Message,
  MessageSettings,
  Role,
} from '@/src/types/chat';
import { EntityType, PartialBy, UploadStatus } from '@/src/types/common';
import { OpenAIEntityAddon, OpenAIEntityModel } from '@/src/types/openai';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-settings';

import { getConversationApiKey, parseConversationApiKey } from '../server/api';
import { constructPath } from './file';
import { compareEntitiesByName, splitPath } from './folders';

export const getAssitantModelId = (
  modelType: EntityType,
  defaultAssistantModelId: string,
  conversationAssistantModelId?: string,
): string | undefined => {
  return modelType === EntityType.Assistant
    ? conversationAssistantModelId ?? defaultAssistantModelId
    : undefined;
};

export const getValidEntitiesFromIds = <T>(
  entitiesIds: string[],
  addonsMap: Partial<Record<string, T>>,
): T[] =>
  entitiesIds.map((entityId) => addonsMap[entityId]).filter(Boolean) as T[];

export const getSelectedAddons = (
  selectedAddons: string[],
  addonsMap: Partial<Record<string, OpenAIEntityAddon>>,
  model?: OpenAIEntityModel,
) => {
  if (model && model.type !== EntityType.Application) {
    const preselectedAddons = model.selectedAddons ?? [];
    const addonsSet = new Set([...preselectedAddons, ...selectedAddons]);

    return getValidEntitiesFromIds(Array.from(addonsSet), addonsMap);
  }

  return null;
};

export const isSettingsChanged = (
  conversation: Conversation,
  newSettings: MessageSettings,
): boolean => {
  const isChanged = Object.keys(newSettings).some((key) => {
    const convSetting = conversation[key as keyof Conversation];
    const newSetting = newSettings[key as keyof MessageSettings];

    if (Array.isArray(convSetting) && Array.isArray(newSetting)) {
      if (convSetting.length !== newSetting.length) {
        return true;
      }

      const sortedConvSetting = [...convSetting].sort();
      const sortedNewSetting = [...newSetting].sort();

      const isArraysEqual: boolean = sortedConvSetting.every(
        (value, index) => value === sortedNewSetting[index],
      );
      return !isArraysEqual;
    }

    return (
      conversation[key as keyof Conversation] !==
      newSettings[key as keyof MessageSettings]
    );
  });

  return isChanged;
};

export const getNewConversationName = (
  conversation: Conversation,
  message: Message,
  updatedMessages: Message[],
): string => {
  const convName = prepareEntityName(
    conversation.name,
    DEFAULT_CONVERSATION_NAME,
  );

  if (
    conversation.replay.isReplay ||
    updatedMessages.length !== 2 ||
    conversation.isNameChanged
  ) {
    return convName;
  }
  const content = prepareEntityName(message.content, DEFAULT_CONVERSATION_NAME);
  if (content.length > 0) {
    return content;
  } else if (message.custom_content?.attachments?.length) {
    const files = message.custom_content.attachments;
    return files[0].title;
  }

  return convName;
};

export const getGeneratedConversationId = <T extends ConversationInfo>(
  conversation: Omit<T, 'id'>,
): string =>
  constructPath(conversation.folderId, getConversationApiKey(conversation));

export const addGeneratedConversationId = <T extends ConversationInfo>(
  conversation: PartialBy<T, 'id'>,
): T => {
  const newId = getGeneratedConversationId(conversation);
  if (!conversation.id || newId !== conversation.id) {
    return {
      ...conversation,
      id: newId,
    } as T;
  }
  return conversation as T;
};

export const parseConversationId = (id: string): ConversationInfo => {
  const { name, parentPath } = splitPath(id);
  return addGeneratedConversationId({
    ...parseConversationApiKey(name),
    folderId: parentPath,
  });
};

export const compareConversationsByDate = (
  convA: ConversationInfo,
  convB: ConversationInfo,
): number => {
  if (convA.lastActivityDate === convB.lastActivityDate) {
    return compareEntitiesByName(convA, convB);
  }
  if (convA.lastActivityDate && convB.lastActivityDate) {
    const dateA = convA.lastActivityDate;
    const dateB = convB.lastActivityDate;
    return dateB - dateA;
  }
  return -1;
};

const removePostfix = (name: string): string => {
  const regex = / \d{1,3}$/;
  let newName = name.trim();
  while (regex.test(newName)) {
    newName = newName.replace(regex, '').trim();
  }
  return newName;
};

export const isValidConversationForCompare = (
  selectedConversation: Conversation,
  candidate: ConversationInfo,
): boolean => {
  if (candidate.isReplay || candidate.isPlayback) {
    return false;
  }

  if (candidate.id === selectedConversation.id) {
    return false;
  }
  return (
    removePostfix(selectedConversation.name) === removePostfix(candidate.name)
  );
};

export const isChosenConversationValidForCompare = (
  selectedConversation: Conversation,
  chosenSelection: Conversation,
): boolean => {
  if (
    chosenSelection.status !== UploadStatus.LOADED ||
    chosenSelection.replay?.isReplay ||
    chosenSelection.playback?.isPlayback
  ) {
    return false;
  }
  if (chosenSelection.id === selectedConversation.id) {
    return false;
  }
  const convUserMessages = chosenSelection.messages.filter(
    (message) => message.role === Role.User,
  );
  const selectedConvUserMessages = selectedConversation.messages.filter(
    (message) => message.role === Role.User,
  );

  if (convUserMessages.length !== selectedConvUserMessages.length) {
    return false;
  }

  return true;
};
