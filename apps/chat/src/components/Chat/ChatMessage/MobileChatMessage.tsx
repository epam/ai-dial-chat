import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
} from '@tabler/icons-react';
import React, { RefObject, useCallback, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Conversation, Message, Role } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ChatMessageContent } from '@/src/components/Chat/ChatMessage/ChatMessageContent';
import { MessageMobileButtons } from '@/src/components/Chat/ChatMessage/MessageButtons';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

interface Props {
  message: Message;
  messageIndex: number;
  conversation: Conversation;
  isLikesEnabled: boolean;
  editDisabled: boolean;
  onEdit: (editedMessage: Message, index: number) => void;
  onLike: (likeStatus: number) => void;
  onDelete: () => void;
  onCopy: () => void;
  messageCopied: boolean;
  onClick?: (
    e: React.MouseEvent<HTMLDivElement>,
    messageRef: RefObject<HTMLDivElement>,
  ) => void;
  isEditing: boolean;
  toggleEditing: (value: boolean) => void;
}

const CONTEXT_MENU_OFFSET = 100;

export const MobileChatMessage = ({
  message,
  onCopy,
  messageCopied,
  onLike,
  editDisabled,
  onDelete,
  toggleEditing,
  isEditing,
  ...props
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const [clientY, setClientY] = useState(0);
  const [clientX, setClientX] = useState(0);
  const [isRemoveConfirmationOpened, setIsRemoveConfirmationOpened] =
    useState(false);

  const handleDeleteMessage = useCallback(() => {
    onDelete();
  }, [onDelete]);

  return (
    <>
      <Menu
        placement="top-start"
        listClassName="z-0 context-menu-chat"
        shouldFlip={false}
        shouldApplySize={false}
        style={{
          top: `${clientY}px`,
          left: `${
            clientX > window.innerWidth / 2
              ? clientX - CONTEXT_MENU_OFFSET
              : clientX
          }px`,
        }}
        type="contextMenu"
        className="w-full text-start"
        trigger={
          <ChatMessageContent
            isEditing={isEditing}
            toggleEditing={toggleEditing}
            message={message}
            onClick={(e, messageRef) => {
              const rect = messageRef.current!.getBoundingClientRect();
              setClientY(e.clientY - rect.top);
              setClientX(e.clientX);
            }}
            {...props}
          />
        }
      >
        <MessageMobileButtons
          message={message}
          onCopy={onCopy}
          messageCopied={messageCopied}
          editDisabled={editDisabled}
          onLike={onLike}
          onDelete={onDelete}
          isEditing={isEditing}
          toggleEditing={toggleEditing}
        />
      </Menu>
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
          if (result) {
            handleDeleteMessage();
          }
        }}
      />
    </>
  );
};
