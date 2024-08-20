import { useEffect, useRef, useState } from 'react';

import {
  Conversation,
  ConversationsTemporarySettings,
  MergedMessages,
  Role,
} from '@/src/types/chat';

interface UseMergedMessagesProps {
  selectedConversations: Conversation[];
  onMessagesChange: (params: {
    isNew?: boolean;
    areConversationsEmpty?: boolean;
    hasNewSelection?: boolean;
  }) => void;
}

export function useMergedMessages({
  selectedConversations,
  onMessagesChange,
}: UseMergedMessagesProps) {
  const [mergedMessages, setMergedMessages] = useState<MergedMessages[]>([]);
  const [isLastMessageError, setIsLastMessageError] = useState(false);
  const [prevSelectedIds, setPrevSelectedIds] = useState<string[]>([]);
  const selectedConversationsTemporarySettings = useRef<
    Record<string, ConversationsTemporarySettings>
  >({});

  useEffect(() => {
    if (selectedConversations.length > 0) {
      const newMergedMessages: MergedMessages[] = [];
      const firstConversationMessages =
        selectedConversations[0].messages.filter((m) => m.role !== Role.System);

      for (let i = 0; i < firstConversationMessages.length; i++) {
        newMergedMessages.push(
          selectedConversations.map((conv) => [
            conv,
            conv.messages?.filter((m) => m.role !== Role.System)[i] || {
              role: Role.Assistant,
              content: '',
            },
            i,
          ]),
        );
      }
      setMergedMessages(newMergedMessages);

      onMessagesChange({
        isNew: true,
        areConversationsEmpty: selectedConversations.every(
          (conv) => !conv.messages.find((m) => m.role !== Role.Assistant),
        ),
      });
    }
  }, [selectedConversations, onMessagesChange]);

  useEffect(() => {
    if (
      !selectedConversations.some((conv) => prevSelectedIds.includes(conv.id))
    ) {
      onMessagesChange({ hasNewSelection: true });
      setPrevSelectedIds(selectedConversations.map((conv) => conv.id));
    }
  }, [selectedConversations, onMessagesChange, prevSelectedIds]);

  useEffect(() => {
    const lastMergedMessages = mergedMessages.length
      ? mergedMessages[mergedMessages.length - 1]
      : [];
    const isErrorInSomeLastMessage = lastMergedMessages.some(
      (mergedStr) => !!mergedStr[1].errorMessage,
    );
    setIsLastMessageError(isErrorInSomeLastMessage);
  }, [mergedMessages]);

  return {
    mergedMessages,
    isLastMessageError,
    selectedConversationsTemporarySettings,
  };
}
