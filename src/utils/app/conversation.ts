import toast from 'react-hot-toast';

import { Conversation, MessageSettings } from '@/src/types/chat';
import {
  OpenAIEntityAddon,
  OpenAIEntityApplicationType,
  OpenAIEntityAssistantType,
  OpenAIEntityModel,
  OpenAIEntityModelType,
} from '@/src/types/openai';

import { errorsMessages } from '@/src/constants/errors';

export const updateConversation = (
  updatedConversation: Conversation,
  allConversations: Conversation[],
) => {
  const updatedConversations = allConversations.map((c) => {
    if (c.id === updatedConversation.id) {
      return updatedConversation;
    }

    return c;
  });

  saveConversations(updatedConversations);

  return updatedConversations;
};

export const saveSelectedConversationIds = (ids: string[]) => {
  localStorage.setItem('selectedConversationIds', JSON.stringify(ids));
};

export const saveConversations = (conversations: Conversation[]) => {
  try {
    localStorage.setItem('conversationHistory', JSON.stringify(conversations));
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      toast.error(errorsMessages.localStorageQuotaExceeded);
    } else {
      throw error;
    }
  }
};

export const getAssitantModelId = (
  modelType:
    | OpenAIEntityModelType
    | OpenAIEntityApplicationType
    | OpenAIEntityAssistantType,
  defaultAssistantModelId: string,
  conversationAssistantModelId?: string,
): string | undefined => {
  return modelType === 'assistant'
    ? conversationAssistantModelId ?? defaultAssistantModelId
    : undefined;
};

export const getSelectedAddons = (
  selectedAddons: string[],
  addonsMap: Partial<Record<string, OpenAIEntityAddon>>,
  model?: OpenAIEntityModel,
) => {
  if (model && model.type !== 'application') {
    const preselectedAddons = model.selectedAddons ?? [];
    const addonsSet = new Set([...preselectedAddons, ...selectedAddons]);
    const mergedSelectedAddons = Array.from(addonsSet)
      .map((addon) => addonsMap[addon])
      .filter(Boolean) as OpenAIEntityAddon[];
    return mergedSelectedAddons;
  }
  return null;
};

export const isSettingsChanged = (
  conversation: Conversation,
  newSettings: MessageSettings,
) => {
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
