import {
  Attachment,
  Conversation,
  ConversationEntityModel,
  Message,
  Stage,
} from '@/src/types/chat';

import {
  DEFAULT_ASSISTANT_SUBMODEL_ID,
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/src/constants/default-ui-settings';
import { FALLBACK_MODEL_ID } from '@/src/constants/default-ui-settings';
import { defaultReplay } from '@/src/constants/replay';

import { constructPath } from './file';
import { getConversationRootId } from './id';

const migrateAttachmentUrls = (attachment: Attachment): Attachment => {
  const getNewAttachmentUrl = (url: string | undefined): string | undefined =>
    url &&
    !url.startsWith('files') &&
    !url.startsWith('http') &&
    !url.startsWith('//')
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
    conversation.assistantModelId ?? DEFAULT_ASSISTANT_SUBMODEL_ID;

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
    replay: conversation.replay || defaultReplay,
    selectedAddons: conversation.selectedAddons ?? [],
    assistantModelId,
    lastActivityDate: conversation.lastActivityDate || Date.now(),
    isMessageStreaming: false,
    isNameChanged: conversation.isNameChanged,
    ...(conversation.playback && {
      playback: conversation.playback,
    }),
  };

  return cleanConversation;
};

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
        const cleanedConversation = cleanConversation(conversation);

        acc.push(cleanedConversation);
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
