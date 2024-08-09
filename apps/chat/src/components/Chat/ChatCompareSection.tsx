import { FC } from 'react';

import { Conversation, ConversationInfo } from '@/src/types/chat';

import { ChatCompareSelect } from './ChatCompareSelect';

interface ChatCompareSectionProps {
  conversations: ConversationInfo[];
  selectedConversations: Conversation[];
  inputHeight: number;
  onConversationSelect: (conversation: ConversationInfo) => void;
}

export const ChatCompareSection: FC<ChatCompareSectionProps> = ({
  conversations,
  selectedConversations,
  inputHeight,
  onConversationSelect,
}: ChatCompareSectionProps) => {
  return (
    <div className="flex h-full w-[50%] flex-col overflow-auto">
      <ChatCompareSelect
        conversations={conversations}
        selectedConversations={selectedConversations}
        onConversationSelect={onConversationSelect}
      />
      <div className="shrink-0" style={{ height: inputHeight + 56 }} />
    </div>
  );
};
