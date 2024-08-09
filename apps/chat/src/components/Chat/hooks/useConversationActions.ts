import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import {
  Conversation,
  ConversationInfo,
  ConversationsTemporarySettings,
  LikeState,
  Message,
  Replay,
} from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { DEFAULT_ASSISTANT_SUBMODEL_ID } from '@/src/constants/default-ui-settings';

interface UseConversationActionsReturnType {
  updateConversation: (
    conversationId: string,
    values: Partial<Conversation>,
  ) => void;
  applyChatSettings: (
    selectedConversations: Conversation[],
    selectedConversationsTemporarySettings: Record<
      string,
      ConversationsTemporarySettings
    >,
  ) => void;
  rateMessage: (
    conversationId: string,
    messageIndex: number,
    rate: LikeState,
  ) => void;
  deleteMessage: (index: number) => void;
  sendMessages: (
    conversations: Conversation[],
    message: Message,
    deleteCount: number,
    activeReplayIndex: number,
  ) => void;
  stopStreamMessage: () => void;
  unselectConversations: (conversationIds: string[]) => void;
  selectForCompare: (conversation: ConversationInfo) => void;
}

export function useConversationActions(
  modelsMap: Partial<Record<string, DialAIEntityModel>>,
  addonsMap: Record<string, unknown>,
): UseConversationActionsReturnType {
  const dispatch = useDispatch();

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

  const updateConversation = useCallback(
    (conversationId: string, values: Partial<Conversation>) => {
      dispatch(
        ConversationsActions.updateConversation({ id: conversationId, values }),
      );
    },
    [dispatch],
  );

  const applyChatSettings = useCallback(
    (
      selectedConversations: Conversation[],
      selectedConversationsTemporarySettings: Record<
        string,
        ConversationsTemporarySettings
      >,
    ) => {
      selectedConversations.forEach((conversation) => {
        const temporarySettings =
          selectedConversationsTemporarySettings[conversation.id];
        if (temporarySettings) {
          updateConversation(conversation.id, {
            messages: [], // Assuming clearStateForMessages is handled elsewhere.
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
    },
    [updateConversation, applySelectedModel, addonsMap],
  );

  const rateMessage = useCallback(
    (conversationId: string, messageIndex: number, rate: LikeState) => {
      dispatch(
        ConversationsActions.rateMessage({
          conversationId,
          messageIndex,
          rate,
        }),
      );
    },
    [dispatch],
  );

  const deleteMessage = useCallback(
    (index: number) => {
      dispatch(ConversationsActions.deleteMessage({ index }));
    },
    [dispatch],
  );

  const sendMessages = useCallback(
    (
      conversations: Conversation[],
      message: Message,
      deleteCount: number,
      activeReplayIndex: number,
    ) => {
      dispatch(
        ConversationsActions.sendMessages({
          conversations,
          message,
          deleteCount,
          activeReplayIndex,
        }),
      );
    },
    [dispatch],
  );

  const stopStreamMessage = useCallback(() => {
    dispatch(ConversationsActions.stopStreamMessage());
  }, [dispatch]);

  const unselectConversations = useCallback(
    (conversationIds: string[]) => {
      dispatch(ConversationsActions.unselectConversations({ conversationIds }));
    },
    [dispatch],
  );

  const selectForCompare = useCallback(
    (conversation: ConversationInfo) => {
      dispatch(ConversationsActions.selectForCompare(conversation));
    },
    [dispatch],
  );

  return {
    updateConversation,
    applyChatSettings,
    rateMessage,
    deleteMessage,
    sendMessages,
    stopStreamMessage,
    unselectConversations,
    selectForCompare,
  };
}
