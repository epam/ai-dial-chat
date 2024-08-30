import { MutableRefObject, useCallback } from 'react';

import { clearStateForMessages } from '@/src/utils/app/clear-messages-state';

import {
  Conversation,
  ConversationInfo,
  ConversationsTemporarySettings,
  LikeState,
  MergedMessages,
  Message,
  Replay,
  Role,
} from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { DialAIEntityAddon, ModelsMap } from '@/src/types/models';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { DEFAULT_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

import { useConversationActions } from './useConversationActions';

export const useChatViewConversationHandlers = (
  modelsMap: ModelsMap,
  addonsMap: Partial<Record<string, DialAIEntityAddon>>,
  selectedConversations: Conversation[],
  mergedMessages: MergedMessages[],
  selectedConversationsTemporarySettings: MutableRefObject<
    Record<string, ConversationsTemporarySettings>
  >,
) => {
  const {
    cancelPlayback,
    deleteMessage,
    rateMessage,
    selectForCompare,
    sendMessages,
    stopStreamMessage,
    unselectConversations,
    updateConversation,
  } = useConversationActions();

  const applySelectedModel = useCallback(
    (
      conversation: Conversation,
      modelId: string | undefined,
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
            ? DEFAULT_ASSISTANT_SUBMODEL_ID
            : undefined,
        replay: updatedReplay,
        selectedAddons: updatedAddons,
      };
    },
    [modelsMap, addonsMap],
  );

  const handleApplySettings = useCallback(() => {
    selectedConversations.forEach((conversation) => {
      const temporarySettings =
        selectedConversationsTemporarySettings.current[conversation.id];
      if (temporarySettings) {
        updateConversation(conversation.id, {
          messages: clearStateForMessages(conversation.messages),
          ...applySelectedModel(conversation, temporarySettings.modelId),
          prompt: temporarySettings.prompt,
          temperature: temporarySettings.temperature,
          assistantModelId: temporarySettings.currentAssistentModelId,
          selectedAddons: temporarySettings.addonsIds.filter(
            (addonId) => addonsMap[addonId],
          ),
          isShared: temporarySettings.isShared,
        });
      }
    });
  }, [
    addonsMap,
    applySelectedModel,
    selectedConversations,
    selectedConversationsTemporarySettings,
    updateConversation,
  ]);

  const handleLike = useCallback(
    (index: number, conversation: Conversation) => (rate: LikeState) => {
      rateMessage(conversation.id, index, rate);
    },
    [rateMessage],
  );

  const handleUnselectConversations = useCallback(
    (id: string) => unselectConversations([id]),
    [unselectConversations],
  );

  const handleSelectForCompare = useCallback(
    (conversation: ConversationInfo) => selectForCompare(conversation),
    [selectForCompare],
  );

  const handleClearConversation = useCallback(
    (conversation: Conversation) => {
      if (conversation) {
        updateConversation(conversation.id, { messages: [] });
      }
    },
    [updateConversation],
  );

  const handleSelectModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      const newAiEntity = modelsMap[modelId];
      if (!newAiEntity && modelId !== REPLAY_AS_IS_MODEL) {
        return;
      }

      updateConversation(
        conversation.id,
        applySelectedModel(conversation, modelId),
      );
    },
    [modelsMap, updateConversation, applySelectedModel],
  );

  const handleSelectAssistantSubModel = useCallback(
    (conversation: Conversation, modelId: string) => {
      updateConversation(conversation.id, { assistantModelId: modelId });
    },
    [updateConversation],
  );

  const handleOnChangeAddon = useCallback(
    (conversation: Conversation, addonId: string) => {
      const isAddonInConversation = conversation.selectedAddons.some(
        (id) => id === addonId,
      );
      if (isAddonInConversation) {
        const filteredAddons = conversation.selectedAddons.filter(
          (id) => id !== addonId,
        );
        updateConversation(conversation.id, { selectedAddons: filteredAddons });
      } else {
        updateConversation(conversation.id, {
          selectedAddons: conversation.selectedAddons.concat(addonId),
        });
      }
    },
    [updateConversation],
  );

  const handleOnApplyAddons = useCallback(
    (conversation: Conversation, addonIds: string[]) => {
      updateConversation(conversation.id, {
        selectedAddons: addonIds.filter((addonId) => addonsMap[addonId]),
      });
    },
    [updateConversation, addonsMap],
  );

  const handleChangePrompt = useCallback(
    (conversation: Conversation, prompt: string) => {
      updateConversation(conversation.id, { prompt });
    },
    [updateConversation],
  );

  const handleChangeTemperature = useCallback(
    (conversation: Conversation, temperature: number) => {
      updateConversation(conversation.id, { temperature });
    },
    [updateConversation],
  );

  const handleDeleteMessage = useCallback(
    (index: number, conv: Conversation) => {
      let finalIndex = index;
      if (conv.messages.at(0)?.role === Role.System) {
        finalIndex += 1;
      }
      deleteMessage(finalIndex);
    },
    [deleteMessage],
  );

  const handleSendMessage = useCallback(
    (message: Message) => {
      sendMessages(selectedConversations, message, 0, 0);
    },
    [sendMessages, selectedConversations],
  );

  const handleStopStreamMessage = useCallback(() => {
    stopStreamMessage();
  }, [stopStreamMessage]);

  const handleRegenerateMessage = useCallback(() => {
    const lastUserMessageIndex = selectedConversations[0].messages
      .map((msg: Message) => msg.role)
      .lastIndexOf(Role.User);
    sendMessages(
      selectedConversations,
      selectedConversations[0].messages[lastUserMessageIndex],
      selectedConversations[0].messages.length - lastUserMessageIndex,
      0,
    );
  }, [sendMessages, selectedConversations]);

  const handleEditMessage = useCallback(
    (editedMessage: Message, index: number) => {
      stopStreamMessage();
      sendMessages(
        selectedConversations,
        editedMessage,
        mergedMessages.length - index,
        0,
      );
    },
    [
      stopStreamMessage,
      sendMessages,
      mergedMessages.length,
      selectedConversations,
    ],
  );

  const handleTemporarySettingsSave = useCallback(
    (conversation: Conversation, args: ConversationsTemporarySettings) => {
      selectedConversationsTemporarySettings.current[conversation.id] = args;
    },
    [selectedConversationsTemporarySettings],
  );

  const handleCancelPlaybackMode = useCallback(() => {
    cancelPlayback();
  }, [cancelPlayback]);

  return {
    handleApplySettings,
    handleCancelPlaybackMode,
    handleChangePrompt,
    handleChangeTemperature,
    handleClearConversation,
    handleDeleteMessage,
    handleEditMessage,
    handleLike,
    handleOnApplyAddons,
    handleOnChangeAddon,
    handleRegenerateMessage,
    handleSelectAssistantSubModel,
    handleSelectForCompare,
    handleSelectModel,
    handleSendMessage,
    handleStopStreamMessage,
    handleTemporarySettingsSave,
    handleUnselectConversations,
  };
};
