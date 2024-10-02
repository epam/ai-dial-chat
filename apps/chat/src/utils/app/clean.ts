import { DefaultsService } from '@/src/utils/app/data/defaults-service';

import { Conversation } from '@/src/types/chat';
import { Prompt } from '@/src/types/prompt';

import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  FALLBACK_ASSISTANT_SUBMODEL_ID,
  FALLBACK_MODEL_ID,
} from '@/src/constants/default-ui-settings';

import { prepareEntityName } from './common';
import { constructPath, isAbsoluteUrl } from './file';
import { getConversationRootId } from './id';

import {
  Attachment,
  ConversationEntityModel,
  Message,
  Stage,
} from '@epam/ai-dial-shared';

const migrateAttachmentUrls = (attachment: Attachment): Attachment => {
  const getNewAttachmentUrl = (url: string | undefined): string | undefined =>
    url &&
    !url.startsWith('metadata') &&
    !url.startsWith('files') &&
    !isAbsoluteUrl(url)
      ? constructPath('files', url)
      : url;

  return {
    ...attachment,
    url: getNewAttachmentUrl(attachment.url),
    reference_url: getNewAttachmentUrl(attachment.reference_url),
  };
};
const migrateStagesAttachmentUrls = (stage: Stage): Stage => {
  return {
    ...stage,
    attachments: stage.attachments?.map(migrateAttachmentUrls),
  };
};

const migrateMessageAttachmentUrls = (message: Message): Message => {
  return {
    ...message,
    custom_content: message.custom_content && {
      ...message.custom_content,
      attachments: message.custom_content.attachments?.map(
        migrateAttachmentUrls,
      ),
      stages: message.custom_content.stages?.map(migrateStagesAttachmentUrls),
    },
  };
};

export const cleanConversation = (
  conversation: Partial<Conversation>,
): Conversation => {
  // added model for each conversation (3/20/23)
  // added system prompt for each conversation (3/21/23)
  // added folders (3/23/23)
  // added prompts (3/26/23)
  // added messages (4/16/23)
  // added replay (6/22/2023)
  // added selectedAddons and refactored to not miss any new fields (7/6/2023)

  const model: ConversationEntityModel = conversation.model
    ? {
        id: conversation.model.id,
      }
    : { id: FALLBACK_MODEL_ID };

  const assistantModelId =
    conversation.assistantModelId ??
    DefaultsService.get('assistantSubmodelId') ??
    FALLBACK_ASSISTANT_SUBMODEL_ID;

  const cleanConversation: Conversation = {
    id:
      conversation.id ||
      constructPath(
        conversation.folderId || getConversationRootId(),
        conversation.name || DEFAULT_CONVERSATION_NAME,
      ),
    name: conversation.name || DEFAULT_CONVERSATION_NAME,
    model: model,
    prompt: conversation.prompt || DEFAULT_SYSTEM_PROMPT,
    temperature: conversation.temperature ?? DEFAULT_TEMPERATURE,
    folderId: conversation.folderId || getConversationRootId(),
    messages: conversation.messages?.map(migrateMessageAttachmentUrls) || [],
    selectedAddons: conversation.selectedAddons ?? [],
    assistantModelId,
    lastActivityDate: conversation.lastActivityDate || 0,
    isNameChanged: conversation.isNameChanged,
    ...(conversation.playback && {
      playback: {
        ...conversation.playback,
        messagesStack:
          conversation.playback.messagesStack?.map(
            migrateMessageAttachmentUrls,
          ) || [],
      },
    }),
    ...(conversation.replay && {
      replay: {
        ...conversation.replay,
        replayUserMessagesStack:
          conversation.replay.replayUserMessagesStack?.map(
            migrateMessageAttachmentUrls,
          ) || [],
      },
    }),
  };

  return cleanConversation;
};

export const cleanPrompt = (prompt: Prompt): Prompt => ({
  id: prompt.id,
  name: prompt.name,
  folderId: prompt.folderId,
  description: prompt.description,
  content: prompt.content ?? '', // will be required soon in https://github.com/epam/ai-dial-chat/issues/78
});

export const cleanConversationHistory = (
  history: Conversation[],
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
        const cleanedConversation = cleanConversation({
          ...conversation,
          name: conversation.name && prepareEntityName(conversation.name),
        });

        acc.push(cleanedConversation);
        return acc;
      } catch (error) {
        console.warn(
          `error while cleaning conversations' history. Deleting culprit`,
          error,
        );
      }
      return acc;
    },
    [],
  );
};
