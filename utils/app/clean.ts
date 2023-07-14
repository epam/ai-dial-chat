import { defaultReplay } from '@/utils/app/defaultStateConstants';

import { Conversation } from '@/types/chat';
import { OpenAIEntityModelID, OpenAIEntityModels } from '@/types/openai';

import {
  DEFAULT_ASSISTANT_SUBMODEL,
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from './const';

import { v4 } from 'uuid';

export const cleanConversationHistory = (history: any[]): Conversation[] => {
  // added model for each conversation (3/20/23)
  // added system prompt for each conversation (3/21/23)
  // added folders (3/23/23)
  // added prompts (3/26/23)
  // added messages (4/16/23)
  // added replay (6/22/2023)
  // added selectedAddons and refactored to not miss any new fields (7/6/2023)

  if (!Array.isArray(history)) {
    console.warn('history is not an array. Returning an empty array.');
    return [];
  }

  return history.reduce(
    (acc: Conversation[], conversation: Partial<Conversation>) => {
      try {
        const model =
          conversation.model ||
          OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ];

        let cleanConversation: Conversation = {
          id: conversation.id || v4(),
          name: conversation.name || DEFAULT_CONVERSATION_NAME,
          model: model,
          prompt: conversation.prompt || DEFAULT_SYSTEM_PROMPT,
          temperature: conversation.temperature ?? DEFAULT_TEMPERATURE,
          folderId: conversation.folderId || null,
          messages: conversation.messages || [],
          replay: conversation.replay || defaultReplay,
          selectedAddons:
            conversation.selectedAddons ||
            (OpenAIEntityModels[model.id as OpenAIEntityModelID]
              .selectedAddons ??
              []),
          assistantModelId:
            conversation.assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id,
        };

        acc.push(cleanConversation);
        return acc;
      } catch (error) {
        console.warn(
          `error while cleaning conversations' history. Removing culprit`,
          error,
        );
      }
      return acc;
    },
    [],
  );
};
