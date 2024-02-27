import React, { FC, memo, useCallback, useState } from 'react';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation, Message } from '@/src/types/chat';

import { ChatMessageContent } from '@/src/components/Chat/ChatMessage/ChatMessageContent';
import { MobileChatMessage } from '@/src/components/Chat/ChatMessage/MobileChatMessage';

export interface Props {
  message: Message;
  messageIndex: number;
  conversation: Conversation;
  isLikesEnabled: boolean;
  editDisabled: boolean;
  onEdit: (editedMessage: Message, index: number) => void;
  onLike: (likeStatus: number) => void;
  onDelete: () => void;
}

export const ChatMessage: FC<Props> = memo(
  ({ message, conversation, onLike, ...props }) => {
    const [messageCopied, setMessageCopied] = useState(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);

    const handleLike = useCallback(
      (likeStatus: number) => {
        if (conversation && onLike) {
          onLike(likeStatus);
        }
      },
      [conversation, onLike],
    );

    const toggleEditing = useCallback((value: boolean) => {
      setIsEditing(value);
    }, []);

    const handleCopy = () => {
      if (!navigator.clipboard) return;

      navigator.clipboard.writeText(message.content).then(() => {
        setMessageCopied(true);
        setTimeout(() => {
          setMessageCopied(false);
        }, 2000);
      });
    };

    if (isSmallScreen() && !isEditing) {
      return (
        <MobileChatMessage
          toggleEditing={toggleEditing}
          isEditing={isEditing}
          messageCopied={messageCopied}
          conversation={conversation}
          onLike={handleLike}
          onCopy={handleCopy}
          message={message}
          {...props}
        />
      );
    }

    return (
      <ChatMessageContent
        toggleEditing={toggleEditing}
        isEditing={isEditing}
        messageCopied={messageCopied}
        conversation={conversation}
        onLike={handleLike}
        onCopy={handleCopy}
        message={message}
        {...props}
      />
    );
  },
);
ChatMessage.displayName = 'ChatMessage';
