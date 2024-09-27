import { FC, memo, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';
import { isMobile, isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ChatMessageContent } from '@/src/components/Chat/ChatMessage/ChatMessageContent';
import { MessageMobileButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu } from '@/src/components/Common/DropdownMenu';

import { ChatMessageTemplatesModal } from './ChatMessageTemplatesModal/ChatMessageTemplatesModal';

import { Feature, LikeState, Message } from '@epam/ai-dial-shared';

export interface Props {
  message: Message;
  messageIndex: number;
  conversation: Conversation;
  isLikesEnabled: boolean;
  editDisabled: boolean;
  onLike: (likeStatus: LikeState) => void;
  onDelete: () => void;
  messagesLength: number;
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
    messagesLength,
    ...props
  }) => {
    const { t } = useTranslation(Translation.Chat);

    const [messageCopied, setMessageCopied] = useState(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [clientY, setClientY] = useState(0);
    const [clientX, setClientX] = useState(0);
    const [isDeleteConfirmationOpened, setIsDeleteConfirmationOpened] =
      useState(false);
    const [isTemplateModalOpened, setIsTemplateModalOpened] = useState(false);

    const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
    const isConversationInvalid = isEntityNameOrPathInvalid(conversation);

    const isLastMessage = messageIndex === (messagesLength ?? 0) - 1;

    const isMessageTemplatesEnabled = useAppSelector((state) =>
      SettingsSelectors.isFeatureEnabled(state, Feature.MessageTemplates),
    );

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

    const toggleEditingTemplates = useCallback(
      (value?: boolean) => {
        setIsTemplateModalOpened(value ?? !isTemplateModalOpened);
      },
      [isTemplateModalOpened],
    );

    const handleCopy = useCallback(() => {
      if (!navigator.clipboard) return;

      navigator.clipboard.writeText(message.content).then(() => {
        setMessageCopied(true);
        setTimeout(() => {
          setMessageCopied(false);
        }, 2000);
      });
    }, [message.content]);

    const handleDeleteMessage = useCallback(() => {
      onDelete();
    }, [onDelete]);

    useEffect(() => {
      if (!onEdit) {
        setIsEditing(false);
      }
    }, [onEdit]);

    return (
      <>
        {(!isSmallScreen() || isOverlay) && !(isMobile() && isOverlay) ? ( // skip if overlay or mobile
          <ChatMessageContent
            isLastMessage={isLastMessage}
            messageIndex={messageIndex}
            onEdit={onEdit}
            onDelete={() => {
              setIsDeleteConfirmationOpened(true);
            }}
            toggleEditing={toggleEditing}
            isEditing={isEditing}
            toggleEditingTemplates={toggleEditingTemplates}
            isEditingTemplates={isTemplateModalOpened}
            messageCopied={messageCopied}
            conversation={conversation}
            onLike={handleLike}
            onCopy={handleCopy}
            message={message}
            onRegenerate={onRegenerate}
            withButtons
            {...props}
          />
        ) : (
          <Menu
            isTriggerEnabled={!isEditing}
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
            enableAncestorScroll
            noFocusReturn
            trigger={
              <ChatMessageContent
                isLastMessage={isLastMessage}
                messageIndex={messageIndex}
                conversation={conversation}
                isEditing={isEditing}
                toggleEditing={toggleEditing}
                toggleEditingTemplates={toggleEditingTemplates}
                isEditingTemplates={isTemplateModalOpened}
                message={message}
                onEdit={onEdit}
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
              isLastMessage={isLastMessage}
              message={message}
              onCopy={handleCopy}
              messageCopied={messageCopied}
              editDisabled={editDisabled}
              onLike={onLike}
              onDelete={() => setIsDeleteConfirmationOpened(true)}
              isEditing={isEditing}
              onToggleEditing={toggleEditing}
              onRegenerate={onRegenerate}
              isConversationInvalid={isConversationInvalid}
              isEditTemplatesAvailable={isMessageTemplatesEnabled}
              onToggleTemplatesEditing={toggleEditingTemplates}
            />
          </Menu>
        )}
        <ConfirmDialog
          isOpen={isDeleteConfirmationOpened}
          heading={t('Confirm deleting message')}
          description={
            t('Are you sure that you want to delete the message?') || ''
          }
          confirmLabel={t('Delete')}
          cancelLabel={t('Cancel')}
          onClose={(result) => {
            setIsDeleteConfirmationOpened(false);
            if (result) handleDeleteMessage();
          }}
        />
        {isTemplateModalOpened && (
          <ChatMessageTemplatesModal
            message={message}
            conversation={conversation}
            isOpen={isTemplateModalOpened}
            onClose={() => {
              setIsTemplateModalOpened(false);
            }}
          />
        )}
      </>
    );
  },
);
ChatMessage.displayName = 'ChatMessage';
