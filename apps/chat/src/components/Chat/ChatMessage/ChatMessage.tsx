import { FC, memo, useCallback, useMemo, useState } from 'react';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityNameOrPathInvalid } from '@/src/utils/app/common';
import { isMobile } from '@/src/utils/app/mobile';

import { Conversation } from '@/src/types/chat';
import { ScreenState } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { ChatMessageContent } from '@/src/components/Chat/ChatMessage/ChatMessageContent/ChatMessageContent';
import { MessageMobileButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu } from '@/src/components/Common/DropdownMenu';

import { ChatMessageTemplatesModal } from './ChatMessageTemplatesModal/ChatMessageTemplatesModal';
import { DislikeCommentModal } from './DislikeCommentModal';

import {
  Feature,
  LikeState,
  Message,
  PublishActions,
  Role,
  onLikeMessageHandler,
} from '@epam/ai-dial-shared';

export interface Props {
  message: Message;
  messageIndex: number;
  filteredMessages: Message[];
  conversation: Conversation;
  isLikesEnabled: boolean;
  editDisabled: boolean;
  messagesLength: number;
  onLike: (
    index: number,
    conversation: Conversation,
    likeStatus: LikeState,
    comment?: string,
  ) => void;
  onDelete?: (messageIndex: number, conversation: Conversation) => void;
  onEdit: (
    editedMessage: Message,
    index: number,
    conversationId: string,
  ) => void;
  onRegenerate?: () => void;
}

const CONTEXT_MENU_OFFSET = 143;
const CONTEXT_MENU_REGENERATE_OFFSET = 173;

export const ChatMessage: FC<Props> = memo(
  ({
    message,
    conversation,
    filteredMessages,
    editDisabled,
    messageIndex,
    messagesLength,
    isLikesEnabled,
    onLike,
    onDelete,
    onRegenerate,
    onEdit,
  }) => {
    const { t } = useTranslation(Translation.Chat);

    const [isEditing, setIsEditing] = useState(false);
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
    const isFirstMessageSystem = useMemo(() => {
      return conversation.messages[0]?.role === Role.System;
    }, [conversation.messages]);
    const realMessageIndex = useMemo(() => {
      return isFirstMessageSystem ? messageIndex + 1 : messageIndex;
    }, [isFirstMessageSystem, messageIndex]);

    const isDislikeCommentEnabled = useAppSelector((state) =>
      SettingsSelectors.isFeatureEnabled(state, Feature.DislikeComment),
    );
    const [isDislikeModalOpen, setDislikeModalOpen] = useState(false);

    const handleLike: onLikeMessageHandler = useCallback(
      (likeStatus: LikeState) => {
        if (conversation && onLike) {
          if (!isDislikeCommentEnabled || likeStatus !== LikeState.Disliked) {
            onLike(messageIndex, conversation, likeStatus);
          } else {
            setDislikeModalOpen(true);
          }
        }
      },
      [conversation, onLike, isDislikeCommentEnabled, messageIndex],
    );

    const handleDislike = useCallback(
      (comment?: string) => {
        onLike(messageIndex, conversation, LikeState.Disliked, comment);
        setDislikeModalOpen(false);
      },
      [conversation, onLike, messageIndex],
    );

    const handleToggleEditing = useCallback((value: boolean) => {
      setIsEditing(value);
    }, []);

    const handleToggleEditingTemplates = useCallback(
      (value?: boolean) => {
        setIsTemplateModalOpened(value ?? !isTemplateModalOpened);
      },
      [isTemplateModalOpened],
    );

    const handleDeleteMessage = useCallback(() => {
      onDelete?.(messageIndex, conversation);
    }, [onDelete, messageIndex, conversation]);

    const handleDelete = useCallback(() => {
      if (!onDelete) return;

      setIsDeleteConfirmationOpened(true);
    }, [onDelete]);

    const screenState = useScreenState();

    return (
      <>
        {isDislikeModalOpen && (
          <DislikeCommentModal
            onClose={() => setDislikeModalOpen(false)}
            onSubmit={(comment: string) => {
              handleDislike(comment);
              setDislikeModalOpen(false);
            }}
          />
        )}
        {(screenState !== ScreenState.SM || isOverlay) &&
        !(isMobile() && isOverlay) ? ( // skip if overlay or mobile
          <ChatMessageContent
            isLastMessage={isLastMessage}
            messageIndex={messageIndex}
            realMessageIndex={realMessageIndex}
            onEdit={onEdit}
            onDelete={onDelete && handleDelete}
            onToggleEditing={handleToggleEditing}
            isEditing={isEditing}
            editDisabled={editDisabled}
            onToggleEditingTemplates={handleToggleEditingTemplates}
            isEditingTemplates={isTemplateModalOpened}
            conversation={conversation}
            allMessages={filteredMessages}
            onLike={handleLike}
            message={message}
            onRegenerate={onRegenerate}
            withButtons={
              conversation.publicationInfo?.action !== PublishActions.DELETE
            }
            isLikesEnabled={isLikesEnabled}
          />
        ) : (
          <Menu
            isTriggerEnabled={
              !isEditing &&
              conversation.publicationInfo?.action !== PublishActions.DELETE
            }
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
                realMessageIndex={realMessageIndex}
                conversation={conversation}
                allMessages={filteredMessages}
                editDisabled={editDisabled}
                isEditing={isEditing}
                onToggleEditing={handleToggleEditing}
                onToggleEditingTemplates={handleToggleEditingTemplates}
                isEditingTemplates={isTemplateModalOpened}
                message={message}
                onEdit={onEdit}
                onClick={(e, messageRef) => {
                  const rect = messageRef.current.getBoundingClientRect();
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
                isLikesEnabled={isLikesEnabled}
              />
            }
          >
            <MessageMobileButtons
              isMessageStreaming={!!conversation.isMessageStreaming}
              isLastMessage={isLastMessage}
              realMessageIndex={realMessageIndex}
              message={message}
              isLikesEnabled={isLikesEnabled}
              editDisabled={editDisabled}
              onLike={handleLike}
              onDelete={onDelete && handleDelete}
              isEditing={isEditing}
              onToggleEditing={handleToggleEditing}
              onRegenerate={onRegenerate}
              isConversationInvalid={isConversationInvalid}
              isEditTemplatesAvailable={isMessageTemplatesEnabled}
              onToggleTemplatesEditing={handleToggleEditingTemplates}
            />
          </Menu>
        )}
        <ConfirmDialog
          isOpen={isDeleteConfirmationOpened}
          heading={t(ChatI18nKeys.ConfirmDeletingMessage)}
          description={t(ChatI18nKeys.AreYouSureDeleteMessage)}
          confirmLabel={t(ChatI18nKeys.Delete)}
          cancelLabel={t(ChatI18nKeys.Cancel)}
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
