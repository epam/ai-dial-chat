import { MutableRefObject, useCallback } from 'react';

import {
  Conversation,
  ConversationInfo,
  ConversationsTemporarySettings,
  LikeState,
  MergedMessages,
  Message,
  Role,
} from '@/src/types/chat';
import { DialAIEntityAddon, ModelsMap } from '@/src/types/models';

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
    applyChatSettings,
    cancelPlayback,
    deleteMessage,
    rateMessage,
    selectForCompare,
    sendMessages,
    stopStreamMessage,
    unselectConversations,
    updateConversation,
  } = useConversationActions(modelsMap, addonsMap);

  const handleApplySettings = useCallback(() => {
    applyChatSettings(
      selectedConversations,
      selectedConversationsTemporarySettings.current,
    );
  }, [
    applyChatSettings,
    selectedConversations,
    selectedConversationsTemporarySettings,
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
      const modelValues: Partial<Conversation> = modelsMap[modelId]
        ? { model: { id: modelId } }
        : {}; // handle undefined modelId lookup

      updateConversation(conversation.id, modelValues);
    },
    [updateConversation, modelsMap],
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
