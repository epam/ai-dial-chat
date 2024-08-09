import { useMemo } from 'react';

import { Conversation, ConversationInfo } from '@/src/types/chat';

import { ChatCompareSelect } from './ChatCompareSelect';

interface ChatCompareProps {
  conversations: ConversationInfo[];
  selectedConversations: Conversation[];
  inputHeight: number;
  isCompareMode: boolean;
  handleSelectForCompare: (conversation: ConversationInfo) => void;
}

export const ChatCompare = ({
  conversations,
  selectedConversations,
  inputHeight,
  isCompareMode,
  handleSelectForCompare,
}: ChatCompareProps) => {
  const shouldDisplay = useMemo(
    () => isCompareMode && selectedConversations.length < 2,
    [isCompareMode, selectedConversations.length],
  );

  if (!shouldDisplay) {
    return null;
  }

  return (
    <div className="flex h-full w-[50%] flex-col overflow-auto">
      <ChatCompareSelect
        conversations={conversations}
        selectedConversations={selectedConversations}
        onConversationSelect={handleSelectForCompare}
      />
      <div className="shrink-0" style={{ height: inputHeight + 56 }} />
    </div>
  );
};
