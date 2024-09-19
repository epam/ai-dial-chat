import { memo } from 'react';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';

import { StoreSelectorsHook } from '@/src/store/useStoreSelectors';

import { ChatHeader } from './components/ChatHeader';

interface ChatHeaderSectionProps {
  useStoreSelectors: StoreSelectorsHook;
  // modelsMap: ModelsMap;
  // addonsMap: Partial<Record<string, DialAIEntityAddon>>;
  // isCompareMode: boolean;
  // isChatFullWidth: boolean;
  // isPlayback: boolean;
  // isExternal: boolean;
  // selectedConversations: Conversation[];
  // selectedConversationsIds: string[];
  showTopChatInfo: boolean;
  showTopSettings: boolean;
  showClearConversations: boolean;
  showModelSelect: boolean;
  showChatSettings: boolean;
  onSetShowSettings: (isShow: boolean) => void;
  onCancelPlaybackMode: () => void;
  onClearConversation: (conv: Conversation) => void;
  onUnselectConversations: (conversationId: string) => void;
}

export const ChatHeaderSection = memo(
  ({
    useStoreSelectors,
    showTopChatInfo,
    showTopSettings,
    showClearConversations,
    showModelSelect,
    showChatSettings,
    onSetShowSettings,
    onCancelPlaybackMode,
    onClearConversation,
    onUnselectConversations,
  }: ChatHeaderSectionProps) => {
    const {
      useAddonsSelectors,
      useModelsSelectors,
      useConversationsSelectors,
      useUISelectors,
    } = useStoreSelectors();
    const { addonsMap } = useAddonsSelectors();
    const { modelsMap } = useModelsSelectors();
    const {
      selectedConversations,
      selectedConversationsIds,
      areSelectedConversationsExternal: isExternal,
      isPlaybackSelectedConversations: isPlayback,
    } = useConversationsSelectors([
      'selectSelectedConversations',
      'selectSelectedConversationsIds',
      'selectAreSelectedConversationsExternal',
      'selectIsPlaybackSelectedConversations',
    ]);
    const { isCompareMode, isChatFullWidth } = useUISelectors();

    return (
      <div className="flex w-full">
        {selectedConversations.map((conv) => (
          <div
            key={conv.id}
            className={classNames(
              isCompareMode && selectedConversations.length > 1
                ? 'w-[50%]'
                : 'w-full',
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
