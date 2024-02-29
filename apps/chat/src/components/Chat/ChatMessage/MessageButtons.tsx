import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
} from '@tabler/icons-react';
import { ButtonHTMLAttributes, FC } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Message, Role } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { MenuItem } from '@/src/components/Common/DropdownMenu';
import Tooltip from '@/src/components/Common/Tooltip';

const Button: FC<ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  className,
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      className={classNames(
        'text-secondary [&:not(:disabled)]:hover:text-accent-primary',
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
  onDelete: () => void;
  editDisabled?: boolean;
}

export const MessageUserButtons = ({
  onDelete,
  toggleEditing,
  editDisabled,
}: MessageUserButtonsProps) => {
  return (
    <div className="mt-4 flex w-full items-center justify-end gap-2">
      <button
        className="text-secondary hover:text-accent-primary disabled:cursor-not-allowed"
        onClick={toggleEditing}
        disabled={editDisabled}
      >
        <IconEdit size={18} />
      </button>
      <button
        className="text-secondary hover:text-accent-primary"
        onClick={onDelete}
      >
        <IconTrash size={18} />
      </button>
    </div>
  );
};

interface MessageAssistantButtonsProps {
  messageCopied?: boolean;
  copyOnClick: () => void;
  isLikesEnabled: boolean;
  message: Message;
  onLike: (likeStatus: number) => void;
}

export const MessageAssistantButtons = ({
  messageCopied,
  copyOnClick,
  message,
  isLikesEnabled,
  onLike,
}: MessageAssistantButtonsProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="mt-4 flex w-full justify-end gap-2">
      <div className="ml-1 flex items-center">
        {messageCopied ? (
          <Tooltip
            placement="top"
            isTriggerClickable
            tooltip={t('Text copied')}
          >
            <IconCheck size={18} className="text-secondary" />
          </Tooltip>
        ) : (
          <Tooltip placement="top" isTriggerClickable tooltip={t('Copy text')}>
            <Button onClick={copyOnClick}>
              <IconCopy size={18} />
            </Button>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-row gap-2">
        {isLikesEnabled && !!message.responseId && (
          <>
            {message.like !== -1 && (
              <Tooltip
                placement="top"
                isTriggerClickable
                tooltip={message.like !== 1 ? t('Like') : t('Liked')}
              >
                <Button
                  onClick={() => {
                    if (message.like !== 1) {
                      onLike(1);
                    }
                  }}
                  className={message.like !== 1 ? void 0 : 'text-secondary'}
                  disabled={message.like === 1}
                  data-qa="like"
                >
                  <IconThumbUp size={18} />
                </Button>
              </Tooltip>
            )}
            {message.like !== 1 && (
              <Tooltip
                placement="top"
                isTriggerClickable
                tooltip={message.like !== -1 ? t('Dislike') : t('Disliked')}
              >
                <Button
                  onClick={() => {
                    if (message.like !== -1) {
                      onLike(-1);
                    }
                  }}
                  className={message.like !== -1 ? void 0 : 'text-secondary'}
                  disabled={message.like === -1}
                  data-qa="dislike"
                >
                  <IconThumbDown size={18} />
                </Button>
              </Tooltip>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface MessageMobileButtonsProps {
  message: Message;
  onCopy: () => void;
  messageCopied: boolean;
  editDisabled: boolean;
  onLike: (likeStatus: number) => void;
  onDelete: () => void;
  isEditing: boolean;
  toggleEditing: (value: boolean) => void;
}

export const MessageMobileButtons = ({
  messageCopied,
  editDisabled,
  message,
  onLike,
  onCopy,
  onDelete,
  isEditing,
  toggleEditing,
}: MessageMobileButtonsProps) => {
  const { t } = useTranslation(Translation.Chat);

  const isAssistant = message.role === Role.Assistant;

  return isAssistant ? (
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
              <IconCopy className="text-secondary" size={18} />
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
              <IconThumbUp className="text-secondary" size={18} />
              <p className={classNames(message.like === 1 && 'text-secondary')}>
                {message.like === 1 ? t('Liked') : t('Like')}
              </p>
            </div>
          }
          disabled={message.like === 1}
          data-qa="like"
          onClick={() => {
            if (message.like !== 1) {
              onLike(1);
            }
          }}
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
              <IconThumbDown className="text-secondary" size={18} />
              <p
                className={classNames(message.like === -1 && 'text-secondary')}
              >
                {message.like === -1 ? t('Disliked') : t('Dislike')}
              </p>
            </div>
          }
          onClick={() => {
            if (message.like !== -1) {
              onLike(-1);
            }
          }}
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
            <IconEdit className="text-secondary" size={18} />
            <p>{t('Edit')}</p>
          </div>
        }
      />
      <MenuItem
        className="hover:text-accent-primary focus:visible group-hover:visible"
        onClick={onDelete}
        item={
          <div className="flex items-center gap-3">
            <IconTrash className="text-secondary" size={18} />
            <p>{t('Delete')}</p>
          </div>
        }
      />
    </>
  );
};
