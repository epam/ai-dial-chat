import {
  getLastPathSegment,
  isEntityNameOrPathInvalid,
  prepareEntityName,
} from '@/src/utils/app/common';
import {
  getConfigurationSchema,
  getConfigurationValue,
  getFormValueDefinitions,
  isConversationWithFormSchema,
} from '@/src/utils/app/form-schema';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import {
  ApiUtils,
  getConversationApiKey,
  parseConversationApiKey,
} from '@/src/utils/server/api';

import { EntityType, ParseOptions, PartialBy } from '@/src/types/common';
import { AddonsMap, DialAIEntityModel, ModelsMap } from '@/src/types/models';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { FALLBACK_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { DefaultsService } from './data/defaults-service';
import { constructPath } from './file';
import {
  getConversationRootId,
  getEntityBucket,
  getFileRootId,
  isEntityIdLocal,
} from './id';

import {
  Conversation,
  ConversationInfo,
  Message,
  MessageSettings,
  Replay,
  Role,
  UploadStatus,
} from '@epam/ai-dial-shared';
import orderBy from 'lodash-es/orderBy';
import uniq from 'lodash-es/uniq';

export const getValidEntitiesFromIds = <T>(
  entitiesIds: string[],
  addonsMap: Partial<Record<string, T>>,
): T[] =>
  entitiesIds.map((entityId) => addonsMap[entityId]).filter(Boolean) as T[];

export const getSelectedAddons = (
  selectedAddons: string[],
  addonsMap: AddonsMap,
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

  const formValue = getConfigurationValue(message);
  const configurationSchema = getConfigurationSchema(message);

  if (content.length > 0) {
    return content;
  } else if (message.custom_content?.attachments?.length) {
    const { title, reference_url } = message.custom_content.attachments[0];

    return prepareEntityName(!title && reference_url ? reference_url : title);
  } else if (formValue && configurationSchema) {
    const definitions = getFormValueDefinitions(formValue, configurationSchema);

    if (definitions.length) return prepareEntityName(definitions[0].title);
  }

  return convName;
};

export const getGeneratedConversationId = (
  conversation: PartialBy<ConversationInfo, 'id'>,
): string => {
  if (conversation.folderId) {
    return constructPath(
      conversation.folderId,
      getConversationApiKey(conversation),
    );
  }
  return constructPath(
    getConversationRootId(
      conversation.id ? getEntityBucket({ id: conversation.id }) : undefined,
    ),
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

export const getConversationInfoFromId = (
  id: string,
  options?: ParseOptions,
): ConversationInfo => {
  const { apiKey, bucket, name, parentPath } = splitEntityId(id);

  return regenerateConversationId({
    ...parseConversationApiKey(name, options),
    folderId: constructPath(apiKey, bucket, parentPath),
  });
};

export const sortByDateAndName = <T extends ConversationInfo>(
  conversations: T[],
): T[] =>
  orderBy(
    conversations,
    ['updatedAt', (conv) => conv.name.toLowerCase()],
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
    isReplayConversation(candidate) ||
    isPlaybackConversation(candidate) ||
    isEntityIdLocal(candidate) ||
    isEntityNameOrPathInvalid(candidate)
  ) {
    return false;
  }

  if (isConversationWithFormSchema(candidate as Conversation)) return false;

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
    isReplayConversation(chosenSelection) ||
    isPlaybackConversation(chosenSelection)
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

export const getOpenAIEntityFullName = (model: { name?: string; id: string }) =>
  model.name || model.id;

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
  modelsMap: ModelsMap,
  addonsMap: AddonsMap,
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
    isReplayConversation(conversation) &&
    isReplayAsIsConversation(conversation) &&
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

export const isSystemMessage = (message?: Message) =>
  message?.role === Role.System;

export const excludeSystemMessages = (messages: Message[]) =>
  messages.filter((m) => !isSystemMessage(m));

export const getSystemMessageContent = (
  messages: Message[],
): string | undefined => messages.filter((m) => isSystemMessage(m))[0]?.content;

export const getDefaultModelReference = ({
  recentModelReferences,
  modelReferences,
  defaultModelReference,
}: {
  recentModelReferences: string[];
  modelReferences: string[];
  defaultModelReference: string;
}) => {
  return [
    ...modelReferences.filter(
      (reference) => reference === defaultModelReference,
    ),
    ...recentModelReferences,
    ...modelReferences,
  ][0];
};

export const isOldConversationReplay = (replay: Replay | undefined) =>
  replay &&
  replay.isReplay &&
  replay.replayUserMessagesStack &&
  replay.replayUserMessagesStack.some((message) => !message.model);

export const isPlaybackConversation = (conversation: ConversationInfo) =>
  (conversation as Conversation).playback?.isPlayback ??
  conversation.isPlayback ??
  false;

export const isReplayConversation = (conversation: ConversationInfo) =>
  (conversation as Conversation).replay?.isReplay ??
  conversation.isReplay ??
  false;

export const isReplayAsIsConversation = (conversation: ConversationInfo) =>
  (conversation as Conversation).replay?.replayAsIs ?? false;

export const getQuickAttachmentsSavingPath = () => {
  const date = new Date();

  return `${getFileRootId()}/uploads/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const updateMessagesAttachmentsTitles = (
  messages: Message[],
  titlesToUpdate: string[],
) => {
  return messages.map((message) => ({
    ...message,
    custom_content: {
      ...message.custom_content,
      attachments: message.custom_content?.attachments?.map((attachment) => {
        const title = ApiUtils.decodeApiUrl(
          getLastPathSegment(attachment.url ?? ''),
        );

        return titlesToUpdate.includes(title)
          ? {
              ...attachment,
              title: title ?? 'Attachment',
            }
          : attachment;
      }),
    },
  }));
};
