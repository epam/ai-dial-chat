import toast from 'react-hot-toast';

import { Conversation } from '@/src/types/chat';
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
