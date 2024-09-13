import { FC } from 'react';

import { ConversationInfo } from '@/src/types/chat';

import { CommonComponentSelectors } from '@/src/components/Chat/Chat';

import { ChatCompareSelect } from './ChatCompareSelect';

interface ChatCompareSectionProps {
  useComponentSelectors: CommonComponentSelectors;
  // conversations: ConversationInfo[];
  // selectedConversations: Conversation[];
  inputHeight: number;
  onConversationSelect: (conversation: ConversationInfo) => void;
}

export const ChatCompareSection: FC<ChatCompareSectionProps> = ({
  useComponentSelectors,
  inputHeight,
  onConversationSelect,
}: ChatCompareSectionProps) => {
  return (
    <div className="flex h-full w-[50%] flex-col overflow-auto">
      <ChatCompareSelect
        useComponentSelectors={useComponentSelectors}
        // conversations={conversations}
        // selectedConversations={selectedConversations}
        onConversationSelect={onConversationSelect}
      />
      <div className="shrink-0" style={{ height: inputHeight + 56 }} />
    </div>
  );
};
