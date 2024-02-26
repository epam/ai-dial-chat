import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
} from '@tabler/icons-react';
import React, { ButtonHTMLAttributes, FC, useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Message } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import Tooltip from '@/src/components/Common/Tooltip';

const Button: FC<ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  className = 'invisible group-hover:visible',
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      className={classNames(
        'text-secondary focus:visible [&:not(:disabled)]:hover:text-accent-primary',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

interface MessageUserButtonsProps {
  toggleEditing: () => void;
  editDisabled: boolean;
  onDelete: () => void;
}

export const MessageUserButtons = ({
  onDelete,
  toggleEditing,
  editDisabled,
}: MessageUserButtonsProps) => {
  const { t } = useTranslation(Translation.Chat);

  const handleDeleteMessage = useCallback(() => {
    onDelete();
  }, [onDelete]);

  const [isRemoveConfirmationOpened, setIsRemoveConfirmationOpened] =
    useState(false);

  return (
    <div className="flex w-[60px] flex-col items-center justify-end gap-4 md:flex-row md:items-start md:justify-start md:gap-1">
      <button
        className="invisible text-secondary hover:text-accent-primary focus:visible disabled:cursor-not-allowed group-hover:visible"
        onClick={toggleEditing}
        disabled={editDisabled}
      >
        <IconEdit size={20} />
      </button>
      <button
        className="invisible text-secondary hover:text-accent-primary focus:visible group-hover:visible"
        onClick={() => {
          setIsRemoveConfirmationOpened(true);
        }}
      >
        <IconTrash size={20} />
      </button>

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
    </div>
  );
};

interface MessageAssistantButtonsProps {
  messagedCopied: boolean;
  copyOnClick: () => void;
  isLikesEnabled: boolean;
  message: Message;
  onLike: (likeStatus: number) => () => void;
}

export const MessageAssistantButtons = ({
  messagedCopied,
  copyOnClick,
  message,
  isLikesEnabled,
  onLike,
}: MessageAssistantButtonsProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex w-[60px] shrink-0 flex-col justify-between">
      <div className="ml-1 flex flex-col items-center justify-end gap-4 md:-mr-8 md:ml-0 md:flex-row md:items-start md:justify-start md:gap-1">
        {messagedCopied ? (
          <IconCheck size={20} className="text-secondary" />
        ) : (
          <Tooltip placement="top" isTriggerClickable tooltip={t('Copy text')}>
            <Button onClick={copyOnClick}>
              <IconCopy size={20} />
            </Button>
          </Tooltip>
        )}
      </div>
      <div className="bottom-0 right-8 flex flex-row gap-2">
        {isLikesEnabled && !!message.responseId && (
          <>
            {message.like !== -1 && (
              <Button
                onClick={message.like !== 1 ? onLike(1) : void 0}
                className={
                  message.like !== 1 ? void 0 : 'visible text-secondary'
                }
                disabled={message.like === 1}
                data-qa="like"
              >
                <IconThumbUp size={24} />
              </Button>
            )}
            {message.like !== 1 && (
              <Button
                onClick={message.like !== -1 ? onLike(-1) : void 0}
                className={
                  message.like !== -1 ? void 0 : 'visible text-secondary'
                }
                disabled={message.like === -1}
                data-qa="dislike"
              >
                <IconThumbDown size={24} />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
