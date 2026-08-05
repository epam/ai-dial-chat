import {
  EntityStorageLimits,
  buildByteAwareFitBaseName,
  getAvailableEntityNameBytes,
  getLastPathSegment,
  getResourceStorageLimits,
  getStorageSafeUniqueName,
  isEntityNameOrPathInvalid,
  prepareEntityName,
  truncateToUtf8Bytes,
} from '@/src/utils/app/common';
import {
  getChosenFormButtons,
  getConfigurationSchema,
  getConfigurationValue,
  isConversationWithFormSchema,
} from '@/src/utils/app/form-schema';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import {
  ApiUtils,
  getConversationApiKey,
  parseEntityApiKey,
} from '@/src/utils/server/api';

import { ApiKeys, PartialBy } from '@/src/types/common';
import { DialAIEntityModel, ModelsMap } from '@/src/types/models';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { DEFAULT_LOCAL } from '@/src/constants/locale';

import { constructPath, isAttachmentLink } from './file';
import type { FileMovesMap } from './folders';
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
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';
import orderBy from 'lodash-es/orderBy';

export const getAvailableConversationNameBytes = (
  conversation: PartialBy<ConversationInfo, 'id'>,
  limits: EntityStorageLimits = getResourceStorageLimits(),
): number | undefined =>
  getAvailableEntityNameBytes(
    (name) => getGeneratedConversationId({ ...conversation, name }),
    (name) => getConversationApiKey({ ...conversation, name }),
    limits,
  );

export const fitConversationNameToStorageLimits = <
  T extends PartialBy<ConversationInfo, 'id'>,
>(
  conversation: T,
  limits: EntityStorageLimits = getResourceStorageLimits(),
): T => {
  const availableNameBytes = getAvailableConversationNameBytes(
    conversation,
    limits,
  );

  if (availableNameBytes === undefined || availableNameBytes <= 0) {
    return conversation;
  }

  const fittedName = prepareEntityName(
    truncateToUtf8Bytes(
      prepareEntityName(conversation.name),
      availableNameBytes,
    ),
  );

  return fittedName === conversation.name
    ? conversation
    : ({
        ...conversation,
        name: fittedName,
      } as T);
};

export const getStorageSafeUniqueConversationName = (params: {
  conversation: PartialBy<ConversationInfo, 'id'>;
  desiredName?: string;
  defaultName?: string;
  existingNames: string[];
  limits?: EntityStorageLimits;
}): string => {
  const { conversation, desiredName, existingNames } = params;
  const limits = params.limits ?? getResourceStorageLimits();
  const defaultName = params.defaultName ?? DEFAULT_CONVERSATION_NAME;

  const availableNameBytes = getAvailableConversationNameBytes(
    conversation,
    limits,
  );

  const uniqueName = getStorageSafeUniqueName({
    desiredName,
    defaultName,
    existingNames,
    fitBaseName: buildByteAwareFitBaseName(availableNameBytes),
  });

  if (uniqueName) {
    return uniqueName;
  }

  return fitConversationNameToStorageLimits({
    ...conversation,
    name:
      prepareEntityName(desiredName ?? '') || prepareEntityName(defaultName),
  }).name;
};

export type ExistingConversationNamesForNamingOptions = {
  isOverlay: boolean;
  overlayNewConversationsFolder?: string | null;
  conversationRootFolderId: string;
};

export const getExistingConversationNamesForNaming = (
  conversations: ConversationInfo[],
  targetConversation: Pick<ConversationInfo, 'id' | 'folderId'>,
  options: ExistingConversationNamesForNamingOptions,
): string[] => {
  const { isOverlay, overlayNewConversationsFolder, conversationRootFolderId } =
    options;

  const sharedFolderId =
    isOverlay && overlayNewConversationsFolder
      ? overlayNewConversationsFolder
      : conversationRootFolderId;

  return conversations
    .filter(
      (conversation) =>
        conversation.id !== targetConversation.id &&
        (conversation.folderId === targetConversation.folderId ||
          conversation.folderId === sharedFolderId),
    )
    .map((conversation) => conversation.name);
};

export const isSettingsChanged = (
  conversation: Conversation,
  newSettings: MessageSettings,
): boolean => {
  return Object.keys(newSettings).some((key) => {
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
    const definitions = getChosenFormButtons(formValue, configurationSchema);

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
  options?: Partial<{ parseVersion: boolean }>,
): ConversationInfo => {
  const { apiKey, bucket, name, parentPath } = splitEntityId(id);
  const {
    modelInfo,
    version,
    name: parsedName,
  } = parseEntityApiKey(name, {
    parseVersion: options?.parseVersion,
    parseModel: true,
  });

  const regeneratePayload: Omit<ConversationInfo, 'id'> = {
    ...modelInfo,
    name: parsedName,
    folderId: constructPath(apiKey, bucket, parentPath),
  };

  if (version) {
    regeneratePayload.publicationInfo = {
      version,
    };
  }

  return regenerateConversationId(regeneratePayload);
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

  return convUserMessages.length === selectedConvUserMessages.length;
};

export const getOpenAIEntityFullName = (model: {
  name?: string | Record<string, string>;
  id: string;
}) => {
  // The required `en` locale is used as the entity identifier / full name.
  const name =
    typeof model.name === 'string' ? model.name : model.name?.[DEFAULT_LOCAL];

  return name || model.id;
};

export const addPausedError = (
  _conversation: Conversation,
  models: DialAIEntityModel[],
  messages: Message[],
): Message[] => {
  if (models.every((m) => m.features?.allowResume)) {
    return messages;
  }
  let assistantMessageIndex = -1;
  messages.forEach((message, index) => {
    if (message.role === Role.Assistant) {
      assistantMessageIndex = index;
    }
  });
  if (
    assistantMessageIndex === -1 ||
    assistantMessageIndex !== messages.length - 1
  ) {
    return messages;
  }

  const assistantMessage = messages[assistantMessageIndex];
  const updatedMessage: Message = {
    ...assistantMessage,
    ...(assistantMessage.custom_content?.stages?.length && {
      custom_content: {
        ...assistantMessage.custom_content,
        stages: assistantMessage.custom_content.stages.filter(
          (stage) => stage.status != null,
        ),
      },
    }),
    errorMessage:
      assistantMessage.errorMessage ??
      'Response generation was stopped. Please regenerate to continue working with conversation',
  };

  return messages.map((message, index) => {
    if (index === assistantMessageIndex) {
      return updatedMessage;
    }

    return message;
  });
};

export const getConversationModelParams = (
  conversation: Conversation,
  modelId: string | undefined,
  modelsMap: ModelsMap,
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

  return {
    model: { id: newAiEntity.reference },
    replay: updatedReplay,
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
  !!replay &&
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

export const getQuickAttachmentsSavingPath = (bucket?: string) => {
  const date = new Date();

  return `${getFileRootId(bucket)}/uploads/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

export const updateAttachmentUrlOnMove = (
  url: string | undefined,
  moves: FileMovesMap,
): string | undefined => {
  if (!url || isAttachmentLink(url)) {
    return url;
  }

  const destinationUrl = moves.get(ApiUtils.decodeApiUrl(url));

  return destinationUrl ? ApiUtils.encodeApiUrl(destinationUrl) : url;
};

export const updateMessagesAttachmentsOnMove = (
  messages: Message[],
  moves: FileMovesMap,
): { messages: Message[]; isUpdated: boolean } => {
  let isUpdated = false;

  const updatedMessages = messages.map((message) => {
    const attachments = message.custom_content?.attachments;

    if (!attachments?.length) {
      return message;
    }

    const updatedAttachments = attachments.map((attachment) => {
      const url = updateAttachmentUrlOnMove(attachment.url, moves);
      const reference_url = updateAttachmentUrlOnMove(
        attachment.reference_url,
        moves,
      );

      if (
        url === attachment.url &&
        reference_url === attachment.reference_url
      ) {
        return attachment;
      }

      isUpdated = true;

      return { ...attachment, url, reference_url };
    });

    return {
      ...message,
      custom_content: {
        ...message.custom_content,
        attachments: updatedAttachments,
      },
    };
  });

  return { messages: isUpdated ? updatedMessages : messages, isUpdated };
};

export const isConversationInfoEntity = (
  entity: ShareEntity,
): entity is ConversationInfo =>
  entity.id.startsWith(`${ApiKeys.Conversations}/`);

export const isLoadedConversationEntity = (
  entity: ShareEntity,
): entity is Conversation =>
  isConversationInfoEntity(entity) && entity.status === UploadStatus.LOADED;

export function getMessageCustomContent(
  message: Message,
  allowAssistantAttachments = false,
): Partial<Message> | undefined {
  return message.custom_content?.state ||
    message.custom_content?.attachments?.length ||
    message.custom_content?.form_value ||
    message.custom_content?.form_schema
    ? {
        custom_content: {
          ...((allowAssistantAttachments || message.role !== Role.Assistant) &&
            message.custom_content?.attachments?.length && {
              attachments: message.custom_content?.attachments,
            }),
          ...(message.custom_content?.state && {
            state: message.custom_content.state,
          }),
          ...(message.custom_content?.form_value && {
            form_value: message.custom_content?.form_value,
          }),
          ...(message.custom_content?.form_schema && {
            form_schema: message.custom_content?.form_schema,
          }),
        },
      }
    : undefined;
}
