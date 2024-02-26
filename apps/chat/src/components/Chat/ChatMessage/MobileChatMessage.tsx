import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
} from '@tabler/icons-react';
import React, { RefObject, useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Conversation, Message, Role } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ChatMessageContent } from '@/src/components/Chat/ChatMessage/ChatMessageContent';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

interface Props {
  message: Message;
  messageIndex: number;
  conversation: Conversation;
  isLikesEnabled: boolean;
  editDisabled: boolean;
  onEdit: (editedMessage: Message, index: number) => void;
  onLike: (likeStatus: number) => () => void;
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

  const isAssistant = message.role === Role.Assistant;

  return (
    <>
      <Menu
        placement="top-start"
        listClassName="z-0 context-menu-chat"
        shouldFlip={false}
        shouldApplySize={false}
        style={{
          top: `${clientY}px`,
          left: `${clientX}px`,
        }}
        type="contextMenu"
        className="w-full text-start"
        trigger={
          <ChatMessageContent
            isEditing={isEditing}
            toggleEditing={toggleEditing}
            onDelete={onDelete}
            editDisabled={editDisabled}
            onLike={onLike}
            messageCopied={messageCopied}
            onCopy={onCopy}
            message={message}
            {...props}
            onClick={(e, messageRef) => {
              const rect = messageRef.current!.getBoundingClientRect();
              setClientY(e.clientY - rect.top);
              setClientX(e.clientX);
            }}
          />
        }
      >
        {isAssistant ? (
          <>
            {messageCopied ? (
              <MenuItem
                item={
                  <div className="flex items-center gap-3">
                    <IconCheck size={20} className="text-secondary" />
                    <p>{t('Copied')}</p>
                  </div>
                }
              />
            ) : (
              <MenuItem
                className="hover:bg-accent-primary-alpha"
                item={
                  <div className="flex items-center gap-3">
                    <IconCopy className="text-secondary" size={20} />
                    <p>{t('Copy')}</p>
                  </div>
                }
                onClick={onCopy}
              />
            )}
            {message.like !== -1 && (
              <MenuItem
                className={classNames(
                  message.like !== 1 && 'hover:bg-accent-primary-alpha',
                )}
                item={
                  <div className="flex items-center gap-3">
                    <IconThumbUp className="text-secondary" size={24} />
                    <p
                      className={classNames(
                        message.like === 1 && 'text-secondary',
                      )}
                    >
                      {message.like === 1 ? t('Liked') : t('Like')}
                    </p>
                  </div>
                }
                disabled={message.like === 1}
                data-qa="like"
                onClick={message.like !== 1 ? onLike(1) : void 0}
              />
            )}
            {message.like !== 1 && (
              <MenuItem
                disabled={message.like === -1}
                className={classNames(
                  message.like === 1 && 'hover:bg-accent-primary-alpha',
                )}
                data-qa="dislike"
                item={
                  <div className="flex items-center gap-3">
                    <IconThumbDown className="text-secondary" size={24} />
                    <p
                      className={classNames(
                        message.like === -1 && 'text-secondary',
                      )}
                    >
                      {message.like === -1 ? t('Disliked') : t('Dislike')}
                    </p>
                  </div>
                }
                onClick={message.like !== -1 ? onLike(-1) : void 0}
              />
            )}
          </>
        ) : (
          <>
            <MenuItem
              className="hover:text-accent-primary focus:visible disabled:cursor-not-allowed group-hover:visible"
              onClick={() => toggleEditing(!isEditing)}
              disabled={editDisabled}
              item={
                <div className="flex items-center gap-3">
                  <IconEdit className="text-secondary" size={24} />
                  <p>{t('Edit')}</p>
                </div>
              }
            />
            <MenuItem
              className="hover:text-accent-primary focus:visible group-hover:visible"
              onClick={() => {
                setIsRemoveConfirmationOpened(true);
              }}
              item={
                <div className="flex items-center gap-3">
                  <IconTrash className="text-secondary" size={24} />
                  <p>{t('Delete')}</p>
                </div>
              }
            />
          </>
        )}
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
