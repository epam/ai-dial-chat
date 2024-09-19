import { FC } from 'react';

import { ConversationInfo } from '@/src/types/chat';

import { StoreSelectorsHook } from '@/src/store/useStoreSelectors';

import { ChatCompareSelect } from './ChatCompareSelect';

interface ChatCompareSectionProps {
  useStoreSelectors: StoreSelectorsHook;
  // conversations: ConversationInfo[];
  // selectedConversations: Conversation[];
  inputHeight: number;
  onConversationSelect: (conversation: ConversationInfo) => void;
}

export const ChatCompareSection: FC<ChatCompareSectionProps> = ({
  useStoreSelectors,
  inputHeight,
  onConversationSelect,
}: ChatCompareSectionProps) => {
  return (
    <div className="flex h-full w-[50%] flex-col overflow-auto">
      <ChatCompareSelect
        useStoreSelectors={useStoreSelectors}
        // conversations={conversations}
        // selectedConversations={selectedConversations}
        onConversationSelect={onConversationSelect}
      />
      <div className="shrink-0" style={{ height: inputHeight + 56 }} />
    </div>
  );
};
