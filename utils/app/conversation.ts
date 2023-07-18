import toast from 'react-hot-toast';

import { Conversation } from '@/types/chat';
import { OpenAIEntityModelType } from '@/types/openai';

import { errorsMessages } from '@/constants/errors';

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
  modelType: OpenAIEntityModelType,
  defaultAssistantModelId: string,
  conversationAssistantModelId?: string,
): string | undefined => {
  return modelType === 'assistant'
    ? conversationAssistantModelId ?? defaultAssistantModelId
    : undefined;
};
