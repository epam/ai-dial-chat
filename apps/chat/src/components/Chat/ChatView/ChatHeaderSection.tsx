import { memo } from 'react';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';
import { DialAIEntityAddon, ModelsMap } from '@/src/types/models';

import { ChatHeader } from './components/ChatHeader';

interface ChatHeaderSectionProps {
  modelsMap: ModelsMap;
  addonsMap: Partial<Record<string, DialAIEntityAddon>>;
  isCompareMode: boolean;
  isChatFullWidth: boolean;
  isPlayback: boolean;
  isExternal: boolean;
  showTopChatInfo: boolean;
  showTopSettings: boolean;
  showClearConversations: boolean;
  showModelSelect: boolean;
  showChatSettings: boolean;
  selectedConversations: Conversation[];
  selectedConversationsIds: string[];
  onSetShowSettings: (isShow: boolean) => void;
  onCancelPlaybackMode: () => void;
  onClearConversation: (conv: Conversation) => void;
  onUnselectConversations: (conversationId: string) => void;
}

export const ChatHeaderSection = memo(
  ({
    modelsMap,
    addonsMap,
    isCompareMode,
    isChatFullWidth,
    isPlayback,
    isExternal,
    showTopChatInfo,
    showTopSettings,
    showClearConversations,
    showModelSelect,
    showChatSettings,
    selectedConversations,
    selectedConversationsIds,
    onSetShowSettings,
    onCancelPlaybackMode,
    onClearConversation,
    onUnselectConversations,
  }: ChatHeaderSectionProps) => {
    return (
      <div className="flex w-full">
        {selectedConversations.map((conv) => (
          <div
            key={conv.id}
            className={classNames(
              isCompareMode && selectedConversations.length > 1 ? 'w-[50%]' : 'w-full',
            )}
          >
            {conv.messages.length !== 0 && showTopSettings && (
              <div className="z-10 flex flex-col">
                <ChatHeader
                  conversation={conv}
                  modelsMap={modelsMap}
                  addonsMap={addonsMap}
                  selectedConversations={selectedConversations}
                  selectedConversationIds={selectedConversationsIds}
                  isCompareMode={isCompareMode}
                  isChatFullWidth={isChatFullWidth}
                  isPlayback={isPlayback}
                  isExternal={isExternal}
                  showChatInfo={showTopChatInfo}
                  showClearConversation={showClearConversations}
                  showModelSelect={showModelSelect}
                  showSettings={showChatSettings}
                  onCancelPlaybackMode={onCancelPlaybackMode}
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
