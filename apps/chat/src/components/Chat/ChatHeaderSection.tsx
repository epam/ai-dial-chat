import { memo } from 'react';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';

import { ChatHeader } from './ChatHeader';

interface ChatHeaderSectionProps {
  conversations: Conversation[];
  isCompareMode: boolean;
  showTopChatInfo: boolean;
  showTopSettings: boolean;
  showClearConversations: boolean;
  showModelSelect: boolean;
  showChatSettings: boolean;
  selectedConversationsIds: string[];
  onSetShowSettings: (isShow: boolean) => void;
  onClearConversation: (conv: Conversation) => void;
  onUnselectConversations: (conversationId: string) => void;
}

export const ChatHeaderSection = memo(
  ({
    conversations,
    isCompareMode,
    showTopChatInfo,
    showTopSettings,
    showClearConversations,
    showModelSelect,
    showChatSettings,
    selectedConversationsIds,
    onSetShowSettings,
    onClearConversation,
    onUnselectConversations,
  }: ChatHeaderSectionProps) => {
    return (
      <div className="flex w-full">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={classNames(
              isCompareMode && conversations.length > 1 ? 'w-[50%]' : 'w-full',
            )}
          >
            {conv.messages.length !== 0 && showTopSettings && (
              <div className="z-10 flex flex-col">
                <ChatHeader
                  conversation={conv}
                  selectedConversationIds={selectedConversationsIds}
                  isCompareMode={isCompareMode}
                  showChatInfo={showTopChatInfo}
                  showClearConversation={showClearConversations}
                  showModelSelect={showModelSelect}
                  showSettings={showChatSettings}
                  onClearConversation={() => onClearConversation(conv)}
                  onSetShowSettings={onSetShowSettings}
                  onUnselectConversation={onUnselectConversations}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  },
);

ChatHeaderSection.displayName = 'ChatHeaderSection';
