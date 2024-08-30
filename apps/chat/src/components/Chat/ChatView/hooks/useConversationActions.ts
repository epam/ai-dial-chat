import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import {
  Conversation,
  ConversationInfo,
  LikeState,
  Message,
} from '@/src/types/chat';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';

interface UseConversationActionsReturnType {
  updateConversation: (
    conversationId: string,
    values: Partial<Conversation>,
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
  cancelPlayback: () => void;
}

export function useConversationActions(): UseConversationActionsReturnType {
  const dispatch = useDispatch();

  const updateConversation = useCallback(
    (conversationId: string, values: Partial<Conversation>) => {
      dispatch(
        ConversationsActions.updateConversation({ id: conversationId, values }),
      );
    },
    [dispatch],
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

  const cancelPlayback = useCallback(() => {
    dispatch(ConversationsActions.playbackCancel());
  }, [dispatch]);

  return {
    cancelPlayback,
    deleteMessage,
    rateMessage,
    selectForCompare,
    sendMessages,
    stopStreamMessage,
    unselectConversations,
    updateConversation,
  };
}
