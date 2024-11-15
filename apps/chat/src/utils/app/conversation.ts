import {
  isEntityNameOrPathInvalid,
  prepareEntityName,
} from '@/src/utils/app/common';

import { Conversation, Replay } from '@/src/types/chat';
import { EntityType, PartialBy } from '@/src/types/common';
import {
  DialAIEntity,
  DialAIEntityAddon,
  DialAIEntityModel,
} from '@/src/types/models';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { FALLBACK_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { getConversationApiKey, parseConversationApiKey } from '../server/api';
import { DefaultsService } from './data/defaults-service';
import { constructPath } from './file';
import { splitEntityId } from './folders';
import { getConversationRootId } from './id';

import {
  ConversationInfo,
  Message,
  MessageSettings,
  Role,
  UploadStatus,
} from '@epam/ai-dial-shared';
import groupBy from 'lodash-es/groupBy';
import orderBy from 'lodash-es/orderBy';
import uniq from 'lodash-es/uniq';
import uniqBy from 'lodash-es/uniqBy';

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
  addonsMap: Partial<Record<string, DialAIEntityAddon>>,
  model?: DialAIEntityModel,
) => {
  if (model && model.type !== EntityType.Application) {
    const preselectedAddons = model.selectedAddons ?? [];
    const addons = uniq([...preselectedAddons, ...selectedAddons]);

    return getValidEntitiesFromIds(addons, addonsMap);
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
): string => {
  const convName = prepareEntityName(conversation.name);
  const content = prepareEntityName(message.content);

  if (content.length > 0) {
    return content;
  } else if (message.custom_content?.attachments?.length) {
    const { title, reference_url } = message.custom_content.attachments[0];

    return prepareEntityName(!title && reference_url ? reference_url : title);
  }

  return convName;
};

export const getGeneratedConversationId = (
  conversation: Omit<ConversationInfo, 'id'>,
): string => {
  if (conversation.folderId) {
    return constructPath(
      conversation.folderId,
      getConversationApiKey(conversation),
    );
  }
  return constructPath(
    getConversationRootId(),
    getConversationApiKey(conversation),
  );
};

export const regenerateConversationId = <T extends ConversationInfo>(
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

export const getConversationInfoFromId = (id: string): ConversationInfo => {
  const { apiKey, bucket, name, parentPath } = splitEntityId(id);
  return regenerateConversationId({
    ...parseConversationApiKey(name),
    folderId: constructPath(apiKey, bucket, parentPath),
  });
};

export const sortByDateAndName = <T extends ConversationInfo>(
  conversations: T[],
): T[] =>
  orderBy(
    conversations,
    ['lastActivityDate', (conv) => conv.name.toLowerCase()],
    ['desc', 'desc'],
  );

const deletePostfix = (name: string): string => {
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
  dontCompareNames?: boolean,
): boolean => {
  if (
    candidate.isReplay ||
    candidate.isPlayback ||
    isEntityNameOrPathInvalid(candidate)
  ) {
    return false;
  }

  if (candidate.id === selectedConversation.id) {
    return false;
  }
  return (
    dontCompareNames ||
    deletePostfix(selectedConversation.name) === deletePostfix(candidate.name)
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

export const getOpenAIEntityFullName = (model: DialAIEntity) =>
  model.name || model.id;

interface ModelGroup {
  groupName: string;
  entities: DialAIEntityModel[];
}

export const groupModelsAndSaveOrder = (
  models: DialAIEntityModel[],
): ModelGroup[] => {
  const uniqModels = uniqBy(models, 'reference');
  const groupedModels = groupBy(uniqModels, (m) => m.name ?? m.reference);
  const insertedSet = new Set();
  const result: ModelGroup[] = [];

  uniqModels.forEach((m) => {
    const key = m.name ?? m.reference;
    if (!insertedSet.has(key)) {
      result.push({ groupName: key, entities: groupedModels[key] });
      insertedSet.add(key);
    }
  });

  return result;
};

export const addPausedError = (
  conversation: Conversation,
  models: DialAIEntityModel[],
  messages: Message[],
): Message[] => {
  if (
    models.every(
      (m) => m.features?.allowResume && !conversation.selectedAddons.length,
    )
  ) {
    return messages;
  }
  let assistentMessageIndex = -1;
  messages.forEach((message, index) => {
    if (message.role === Role.Assistant) {
      assistentMessageIndex = index;
    }
  });
  if (
    assistentMessageIndex === -1 ||
    assistentMessageIndex !== messages.length - 1
  ) {
    return messages;
  }

  const assistentMessage = messages[assistentMessageIndex];
  const updatedMessage: Message = {
    ...assistentMessage,
    ...(assistentMessage.custom_content?.stages?.length && {
      custom_content: {
        ...assistentMessage.custom_content,
        stages: assistentMessage.custom_content.stages.filter(
          (stage) => stage.status != null,
        ),
      },
    }),
    errorMessage:
      assistentMessage.errorMessage ??
      'Response generation was stopped. Please regenerate to continue working with conversation',
  };

  return messages.map((message, index) => {
    if (index === assistentMessageIndex) {
      return updatedMessage;
    }

    return message;
  });
};

export const getConversationModelParams = (
  conversation: Conversation,
  modelId: string | undefined,
  modelsMap: Partial<Record<string, DialAIEntityModel>>,
  addonsMap: Partial<Record<string, DialAIEntityAddon>>,
): Partial<Conversation> => {
  if (modelId === REPLAY_AS_IS_MODEL && conversation.replay) {
    return {
      replay: {
        ...conversation.replay,
        replayAsIs: true,
      },
    };
  }
  const newAiEntity = modelId ? modelsMap[modelId] : undefined;
  if (!modelId || !newAiEntity) {
    return {};
  }

  const updatedReplay: Replay | undefined = !conversation.replay?.isReplay
    ? conversation.replay
    : {
        ...conversation.replay,
        replayAsIs: false,
      };
  const updatedAddons =
    conversation.replay &&
    conversation.replay.isReplay &&
    conversation.replay.replayAsIs &&
    !updatedReplay?.replayAsIs
      ? conversation.selectedAddons.filter((addonId) => addonsMap[addonId])
      : conversation.selectedAddons;

  return {
    model: { id: newAiEntity.reference },
    assistantModelId:
      newAiEntity.type === EntityType.Assistant
        ? DefaultsService.get(
            'assistantSubmodelId',
            FALLBACK_ASSISTANT_SUBMODEL_ID,
          )
        : undefined,
    replay: updatedReplay,
    selectedAddons: updatedAddons,
  };
};
