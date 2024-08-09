import { useEffect, useRef, useState } from 'react';

import { Conversation, MergedMessages, Role } from '@/src/types/chat';

interface UseMergedMessagesProps {
  selectedConversations: Conversation[];
  onMessagesChange: (params: {
    isNew?: boolean;
    areConversationsEmpty?: boolean;
    shouldAutoScroll?: boolean;
  }) => void;
}

export function useMergedMessages({
  selectedConversations,
  onMessagesChange,
}: UseMergedMessagesProps) {
  const [mergedMessages, setMergedMessages] = useState<MergedMessages[]>([]);
  const [isLastMessageError, setIsLastMessageError] = useState(false);
  const prevSelectedIds = useRef<string[]>([]);
  const selectedConversationsTemporarySettings = useRef<Record<string, any>>(
    {},
  );

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
    const lastMergedMessages = mergedMessages.length
      ? mergedMessages[mergedMessages.length - 1]
      : [];
    const isErrorInSomeLastMessage = lastMergedMessages.some(
      (mergedStr) => !!mergedStr[1].errorMessage,
    );
    setIsLastMessageError(isErrorInSomeLastMessage);
  }, [mergedMessages]);

  useEffect(() => {
    if (
      !selectedConversations
        .map((conv) => conv.id)
        .some((id) => prevSelectedIds.current.includes(id))
    ) {
      onMessagesChange({ shouldAutoScroll: true });
      prevSelectedIds.current = selectedConversations.map((conv) => conv.id);
    }
  }, [selectedConversations, onMessagesChange]);

  return {
    mergedMessages,
    isLastMessageError,
    selectedConversationsTemporarySettings,
  };
}
