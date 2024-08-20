import { ForwardedRef, forwardRef, memo } from 'react';

import classNames from 'classnames';

import { Conversation, LikeState, Message } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';

import { MemoizedChatMessage } from './MemoizedChatMessage';

interface ChatMessagesProps {
  mergedMessages: [Conversation, Message, number][][];
  selectedConversations: Conversation[];
  isCompareMode: boolean;
  isLikesEnabled: boolean;
  notAllowedType: EntityType | null;
  isExternal: boolean;
  isReplay: boolean;
  isPlayback: boolean;
  showLastMessageRegenerate: boolean;
  onEditMessage: (editedMessage: Message, index: number) => void;
  onLike: (
    index: number,
    conversation: Conversation,
  ) => (rate: LikeState) => void;
  onDeleteMessage: (index: number, conv: Conversation) => void;
  onRegenerateMessage: () => void;
}

export const ChatMessages = memo(
  forwardRef<HTMLDivElement, ChatMessagesProps>(
    (
      {
        mergedMessages,
        selectedConversations,
        isCompareMode,
        isLikesEnabled,
        notAllowedType,
        isExternal,
        isReplay,
        isPlayback,
        showLastMessageRegenerate,
        onEditMessage,
        onLike,
        onDeleteMessage,
        onRegenerateMessage,
      },
      ref: ForwardedRef<HTMLDivElement>,
    ) => {
      const showMessages = mergedMessages?.length > 0;
      const editDisabled =
        !!notAllowedType || isExternal || isReplay || isPlayback;

      return (
        <div ref={ref}>
          {showMessages && (
            <div className="flex flex-col" data-qa="chat-messages">
              {mergedMessages.map(
                (mergedStr: [Conversation, Message, number][], i: number) => (
                  <div
                    key={i}
                    className="flex w-full"
                    data-qa={
                      isCompareMode ? 'compare-message-row' : 'message-row'
                    }
                  >
                    {mergedStr.map(([conv, message, index]) => (
                      <div
                        key={conv.id}
                        className={classNames(
                          isCompareMode && selectedConversations.length > 1
                            ? 'w-[50%]'
                            : 'w-full',
                        )}
                      >
                        <div className="size-full">
                          <MemoizedChatMessage
                            key={conv.id}
                            message={message}
                            messageIndex={index}
                            conversation={conv}
                            isLikesEnabled={isLikesEnabled}
                            editDisabled={editDisabled}
                            onEdit={onEditMessage}
                            onLike={onLike(index, conv)}
                            onDelete={() => {
                              onDeleteMessage(index, conv);
                            }}
                            onRegenerate={
                              index === mergedMessages.length - 1 &&
                              showLastMessageRegenerate
                                ? onRegenerateMessage
                                : undefined
                            }
                            messagesLength={mergedMessages.length}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      );
    },
  ),
);
