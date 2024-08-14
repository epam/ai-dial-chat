import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconRefresh,
  IconThumbDown,
  IconThumbUp,
  IconTrash,
} from '@tabler/icons-react';
import { ButtonHTMLAttributes, FC } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { LikeState, Message, Role } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

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
        '[&:not(:disabled)]:hover:text-primary-bg-light',
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
  isEditAvailable: boolean;
  isMessageStreaming: boolean;
  editDisabled?: boolean;
}

export const MessageUserButtons = ({
  onDelete,
  toggleEditing,
  isEditAvailable,
  editDisabled,
  isMessageStreaming,
}: MessageUserButtonsProps) => {
  const { t } = useTranslation(Translation.Chat);

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  return (
    <div
      className={classNames(
        'flex h-[18px] w-full items-center justify-start gap-2',
        isOverlay ? 'mt-3' : 'mt-2',
      )}
    >
      {!isMessageStreaming && (
        <>
          {isEditAvailable && (
            <Tooltip
              placement="top"
              isTriggerClickable
              tooltip={t('chat.chat_message.button.edit.label')}
            >
              <button
                className="text-tertiary-bg-light hover:text-primary-bg-light disabled:cursor-not-allowed"
                onClick={toggleEditing}
                disabled={editDisabled}
              >
                <IconEdit size={18} />
              </button>
            </Tooltip>
          )}
          <Tooltip
            placement="top"
            isTriggerClickable
            tooltip={t('chat.chat_message.button.delete.label')}
          >
            <button
              className="text-tertiary-bg-light hover:text-primary-bg-light"
              onClick={onDelete}
            >
              <IconTrash size={18} />
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );
};

interface MessageAssistantButtonsProps {
  messageCopied?: boolean;
  copyOnClick: () => void;
  isLikesEnabled: boolean;
  message: Message;
  onLike: (likeStatus: LikeState) => void;
  onRegenerate?: () => void;
}

export const MessageAssistantButtons = ({
  messageCopied,
  copyOnClick,
  message,
  isLikesEnabled,
  onLike,
  onRegenerate,
}: MessageAssistantButtonsProps) => {
  const { t } = useTranslation(Translation.Chat);

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  return (
    <div
      className={classNames(
        'flex w-full justify-start gap-2',
        isOverlay ? 'mt-3' : 'mt-2',
      )}
    >
      {onRegenerate && (
        <Tooltip
          placement="top"
          isTriggerClickable
          tooltip={t('chat.chat_message.button.regenerate.label')}
        >
          <Button
            onClick={onRegenerate}
            data-qa="regenerate"
            className="text-tertiary-bg-light"
          >
            <IconRefresh size={18} />
          </Button>
        </Tooltip>
      )}
      {messageCopied ? (
        <Tooltip
          key="copied"
          placement="top"
          tooltip={t('chat.chat_message.button.copy_text.text')}
        >
          <IconCheck size={18} className="text-secondary-bg-dark" />
        </Tooltip>
      ) : (
        <Tooltip
          key="copy"
          placement="top"
          isTriggerClickable
          tooltip={t('chat.chat_message.button.copy_text.label')}
        >
          <Button className="text-tertiary-bg-light" onClick={copyOnClick}>
            <IconCopy size={18} />
          </Button>
        </Tooltip>
      )}
      <div className="flex flex-row gap-2">
        {isLikesEnabled && !!message.responseId && (
          <>
            {message.like !== LikeState.Disliked && (
              <Tooltip
                placement="top"
                isTriggerClickable={message.like !== LikeState.Liked}
                tooltip={
                  message.like !== LikeState.Liked
                    ? t('chat.chat_message.button.like.label')
                    : t('chat.chat_message.button.like.text')
                }
              >
                <Button
                  onClick={() => {
                    if (message.like !== LikeState.NoState) {
                      onLike(LikeState.Liked);
                    }
                  }}
                  className={
                    message.like !== LikeState.Liked
                      ? 'text-tertiary-bg-light'
                      : 'text-primary-bg-light'
                  }
                  disabled={message.like === LikeState.Liked}
                  data-qa="like"
                >
                  <IconThumbUp size={18} />
                </Button>
              </Tooltip>
            )}
            {message.like !== LikeState.Liked && (
              <Tooltip
                placement="top"
                isTriggerClickable={message.like !== LikeState.Disliked}
                tooltip={
                  message.like !== LikeState.Disliked
                    ? t('chat.chat_message.button.dislike.label')
                    : t('chat.chat_message.button.dislike.text')
                }
              >
                <Button
                  onClick={() => {
                    if (message.like !== LikeState.NoState) {
                      onLike(LikeState.Disliked);
                    }
                  }}
                  className={
                    message.like !== LikeState.Disliked
                      ? 'text-tertiary-bg-light'
                      : 'text-primary-bg-light'
                  }
                  disabled={message.like === LikeState.Disliked}
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
  onLike: (likeStatus: LikeState) => void;
  onDelete: () => void;
  isEditing: boolean;
  toggleEditing: (value: boolean) => void;
  isLastMessage: boolean;
  isMessageStreaming: boolean;
  onRegenerate?: () => void;
  isConversationInvalid: boolean;
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
  onRegenerate,
  isLastMessage,
  isMessageStreaming,
  isConversationInvalid,
}: MessageMobileButtonsProps) => {
  const { t } = useTranslation(Translation.Chat);

  const isAssistant = message.role === Role.Assistant;

  if (isAssistant) {
    return (
      !(isMessageStreaming && isLastMessage) &&
      !isConversationInvalid && (
        <>
          {messageCopied ? (
            <MenuItem
              item={
                <div className="flex items-center gap-3">
                  <IconCheck size={20} className="text-primary-bg-dark" />
                  <p>{t('chat.chat_message.button.copied.label')}</p>
                </div>
              }
            />
          ) : (
            <MenuItem
              className="hover:bg-accent-primary-alpha"
              item={
                <div className="flex items-center gap-3">
                  <IconCopy className="text-primary-bg-dark" size={18} />
                  {t('chat.chat_message.button.copy.label')}
                </div>
              }
              onClick={onCopy}
            />
          )}
          {onRegenerate && (
            <MenuItem
              item={
                <div className="flex items-center gap-3">
                  <IconRefresh className="text-primary-bg-dark" size={18} />
                  {t('chat.chat_message.button.regenerate.label')}
                </div>
              }
              data-qa="regenerate"
              onClick={onRegenerate}
            />
          )}
          {message.like !== LikeState.Disliked && (
            <MenuItem
              className={classNames(
                message.like !== LikeState.Liked &&
                  'hover:bg-accent-primary-alpha',
              )}
              item={
                <div
                  className={classNames(
                    'flex items-center gap-3',
                    message.like === LikeState.Liked
                      ? 'text-accent-primary'
                      : 'text-primary-bg-dark',
                  )}
                >
                  <IconThumbUp size={18} />
                  <p>
                    {message.like === LikeState.Liked
                      ? t('chat.chat_message.button.like.text')
                      : t('chat.chat_message.button.like.label')}
                  </p>
                </div>
              }
              disabled={message.like === LikeState.Liked}
              data-qa="like"
              onClick={() => {
                if (message.like !== LikeState.NoState) {
                  onLike(LikeState.Liked);
                }
              }}
            />
          )}
          {message.like !== LikeState.Liked && (
            <MenuItem
              disabled={message.like === LikeState.Disliked}
              className={classNames(
                message.like !== LikeState.Disliked &&
                  'hover:bg-accent-primary-alpha',
              )}
              data-qa="dislike"
              item={
                <div
                  className={classNames(
                    'flex items-center gap-3',
                    message.like === LikeState.Disliked
                      ? 'text-accent-primary'
                      : 'text-primary-bg-dark',
                  )}
                >
                  <IconThumbDown className="" size={18} />
                  <p>
                    {message.like === LikeState.Disliked
                      ? t('chat.chat_message.button.dislike.text')
                      : t('chat.chat_message.button.dislike.label')}
                  </p>
                </div>
              }
              onClick={() => {
                if (message.like !== LikeState.NoState) {
                  onLike(LikeState.Disliked);
                }
              }}
            />
          )}
        </>
      )
    );
  }

  return (
    !editDisabled &&
    !isMessageStreaming &&
    !isConversationInvalid && (
      <>
        <MenuItem
          className="hover:bg-accent-primary-alpha focus:visible disabled:cursor-not-allowed group-hover:visible"
          onClick={() => toggleEditing(!isEditing)}
          disabled={editDisabled}
          item={
            <div className="flex items-center gap-3">
              <IconEdit className="text-primary-bg-dark" size={18} />
              <p>{t('chat.chat_message.button.edit.label')}</p>
            </div>
          }
        />
        <MenuItem
          className="hover:bg-accent-primary-alpha focus:visible group-hover:visible"
          onClick={onDelete}
          item={
            <div className="flex items-center gap-3">
              <IconTrash className="text-primary-bg-dark" size={18} />
              <p>{t('chat.chat_message.button.delete.label')}</p>
            </div>
          }
        />
      </>
    )
  );
};
