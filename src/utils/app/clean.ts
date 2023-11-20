import { Conversation, ConversationEntityModel } from '@/src/types/chat';
import { OpenAIEntityModelID } from '@/src/types/openai';

import {
  DEFAULT_ASSISTANT_SUBMODEL,
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '../../constants/default-settings';
import { defaultReplay } from '@/src/constants/replay';

import { v4 } from 'uuid';

export const cleanConversationHistory = (
  history: Conversation[] | unknown,
): Conversation[] => {
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
        const model: ConversationEntityModel = conversation.model
          ? {
              id: conversation.model.id,
            }
          : { id: OpenAIEntityModelID.GPT_3_5_AZ };

        const assistantModelId =
          conversation.assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL.id;

        const cleanConversation: Conversation = {
          id: conversation.id || v4(),
          name: conversation.name || DEFAULT_CONVERSATION_NAME,
          model: model,
          prompt: conversation.prompt || DEFAULT_SYSTEM_PROMPT,
          temperature: conversation.temperature ?? DEFAULT_TEMPERATURE,
          folderId: conversation.folderId || undefined,
          messages: conversation.messages || [],
          replay: conversation.replay || defaultReplay,
          selectedAddons: conversation.selectedAddons ?? [],
          assistantModelId,
          lastActivityDate: conversation.lastActivityDate,
          isMessageStreaming: false,
          ...(conversation.playback && {
            playback: conversation.playback,
          }),
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
