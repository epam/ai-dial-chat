import { FC, memo, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isMobile, isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation, LikeState, Message } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ChatMessageContent } from '@/src/components/Chat/ChatMessage/ChatMessageContent';
import { MessageMobileButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu } from '@/src/components/Common/DropdownMenu';

export interface Props {
  message: Message;
  messageIndex: number;
  conversation: Conversation;
  isLikesEnabled: boolean;
  editDisabled: boolean;
  onLike: (likeStatus: LikeState) => void;
  onDelete: () => void;
  onEdit?: (editedMessage: Message, index: number) => void;
  onRegenerate?: () => void;
}

const CONTEXT_MENU_OFFSET = 100;
const CONTEXT_MENU_REGENERATE_OFFSET = 130;

export const ChatMessage: FC<Props> = memo(
  ({
    message,
    conversation,
    onLike,
    onDelete,
    editDisabled,
    onRegenerate,
    onEdit,
    messageIndex,
    ...props
  }) => {
    const { t } = useTranslation(Translation.Chat);

    const [messageCopied, setMessageCopied] = useState(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [clientY, setClientY] = useState(0);
    const [clientX, setClientX] = useState(0);
    const [isRemoveConfirmationOpened, setIsRemoveConfirmationOpened] =
      useState(false);

    const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

    const handleLike = useCallback(
      (likeStatus: LikeState) => {
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

    const handleDeleteMessage = useCallback(() => {
      onDelete();
    }, [onDelete]);

    useEffect(() => {
      if (!onEdit) {
        setIsEditing(false);
      }
    }, [onEdit]);

    const confirmationDialog = (
      <ConfirmDialog
        isOpen={isRemoveConfirmationOpened}
        heading={t('Confirm removing message')}
        description={
          t('Are you sure that you want to remove the message?') || ''
        }
        confirmLabel={t('Remove')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsRemoveConfirmationOpened(false);
          if (result) handleDeleteMessage();
        }}
      />
    );

    if (
      (!isSmallScreen() || isEditing || isOverlay) &&
      !(isMobile() && isOverlay) // skip if overlay on mobile
    ) {
      return (
        <>
          <ChatMessageContent
            messageIndex={messageIndex}
            onEdit={onEdit}
            onDelete={() => {
              setIsRemoveConfirmationOpened(true);
            }}
            toggleEditing={toggleEditing}
            isEditing={isEditing}
            messageCopied={messageCopied}
            conversation={conversation}
            onLike={handleLike}
            onCopy={handleCopy}
            message={message}
            onRegenerate={onRegenerate}
            withButtons
            {...props}
          />
          {confirmationDialog}
        </>
      );
    }

    return (
      <>
        <Menu
          placement="top-start"
          listClassName="context-menu-chat bg-layer-3"
          shouldFlip={false}
          shouldApplySize={false}
          style={{
            top: `${clientY}px`,
            left: `${clientX}px`,
          }}
          type="contextMenu"
          className="w-full text-start"
          dismissIfScroll
          noFocusReturn
          trigger={
            <ChatMessageContent
              messageIndex={messageIndex}
              conversation={conversation}
              isEditing={isEditing}
              toggleEditing={toggleEditing}
              message={message}
              onClick={(e, messageRef) => {
                const rect = messageRef.current!.getBoundingClientRect();
                setClientY(e.clientY - rect.y);
                setClientX(
                  e.clientX -
                    rect.x -
                    (e.pageX > window.innerWidth / 2
                      ? onRegenerate
                        ? CONTEXT_MENU_REGENERATE_OFFSET
                        : CONTEXT_MENU_OFFSET
                      : 0),
                );
              }}
              {...props}
            />
          }
        >
          <MessageMobileButtons
            isMessageStreaming={!!conversation.isMessageStreaming}
            isLastMessage={
              messageIndex === (conversation?.messages.length ?? 0) - 1
            }
            message={message}
            onCopy={handleCopy}
            messageCopied={messageCopied}
            editDisabled={editDisabled}
            onLike={onLike}
            onDelete={() => setIsRemoveConfirmationOpened(true)}
            isEditing={isEditing}
            toggleEditing={toggleEditing}
            onRegenerate={onRegenerate}
          />
        </Menu>
        {confirmationDialog}
      </>
    );
  },
);
ChatMessage.displayName = 'ChatMessage';
