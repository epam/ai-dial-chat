import {
  IconCheck,
  IconCopy,
  IconEdit,
  IconListDetails,
  IconRefresh,
  IconThumbDown,
  IconThumbUp,
  IconTrashX,
} from '@tabler/icons-react';
import { ButtonHTMLAttributes, FC } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getMessageCustomContent } from '@/src/utils/server/chat';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  OverlaySelectors,
  SettingsSelectors,
} from '@/src/store/selectors';

import { MenuItem } from '@/src/components/Common/DropdownMenu';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { OverlayMessageCustomButton } from './ChatMessageContent/OverlayMessageCustomButtons';

import { Feature, LikeState, Message, Role } from '@epam/ai-dial-shared';

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
        '[&:not(:disabled)]:hover:text-accent-primary',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

interface MessageUserButtonsProps {
  realMessageIndex: number;
  isEditAvailable: boolean;
  isMessageStreaming: boolean;
  isEditTemplatesAvailable: boolean;
  onToggleEditing: () => void;
  onDelete?: () => void;
  onToggleTemplatesEditing: () => void;
}

export const MessageUserButtons = ({
  realMessageIndex,
  isEditAvailable,
  isMessageStreaming,
  isEditTemplatesAvailable,
  onDelete,
  onToggleEditing,
  onToggleTemplatesEditing,
}: MessageUserButtonsProps) => {
  const { t } = useTranslation(Translation.Chat);

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const isConversationsWithSchema = useAppSelector(
    ConversationsSelectors.selectIsSelectedConversationsWithSchema,
  );
  const customMessageButtons = useAppSelector((state) =>
    OverlaySelectors.selectPrependedDefaultButtonsForMessage(
      state,
      realMessageIndex,
    ),
  );

  return (
    <div
      className={classNames(
        'flex h-[18px] w-full select-none items-center justify-end gap-2',
        isOverlay ? 'mt-3' : 'mt-4',
      )}
    >
      {!isMessageStreaming && (
        <>
          {customMessageButtons?.map((item) => (
            <OverlayMessageCustomButton
              key={item.buttonKey}
              button={item}
              defaultClassName="text-secondary hover:text-accent-primary"
              realMessageIndex={realMessageIndex}
            />
          ))}
          {isEditTemplatesAvailable && !isConversationsWithSchema && (
            <Tooltip
              placement="top"
              isTriggerClickable
              tooltip={t('Set message template')}
            >
              <button
                className="text-secondary hover:text-accent-primary disabled:cursor-not-allowed"
                onClick={onToggleTemplatesEditing}
              >
                <IconListDetails size={18} />
              </button>
            </Tooltip>
          )}
          {isEditAvailable && (
            <Tooltip placement="top" isTriggerClickable tooltip={t('Edit')}>
              <button
                className="text-secondary hover:text-accent-primary disabled:cursor-not-allowed"
                onClick={onToggleEditing}
              >
                <IconEdit size={18} />
              </button>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip placement="top" isTriggerClickable tooltip={t('Delete')}>
              <button
                className="text-secondary hover:text-accent-primary"
                onClick={onDelete}
              >
                <IconTrashX size={18} />
              </button>
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
};

interface MessageAssistantButtonsProps {
  realMessageIndex: number;
  messageCopied?: boolean;
  isLikesEnabled: boolean;
  message: Message;
  copyOnClick: () => void;
  onLike: (likeStatus: LikeState) => void;
  onRegenerate?: () => void;
  onToggleEditing?: () => void;
}

export const MessageAssistantButtons = ({
  messageCopied,
  message,
  realMessageIndex,
  isLikesEnabled,
  copyOnClick,
  onLike,
  onRegenerate,
  onToggleEditing,
}: MessageAssistantButtonsProps) => {
  const { t } = useTranslation(Translation.Chat);

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const customMessageButtons = useAppSelector((state) =>
    OverlaySelectors.selectPrependedDefaultButtonsForMessage(
      state,
      realMessageIndex,
    ),
  );

  return (
    <div
      className={classNames(
        'flex w-full select-none justify-end gap-2',
        isOverlay ? 'mt-3' : 'mt-4',
      )}
    >
      {customMessageButtons?.map((item) => (
        <OverlayMessageCustomButton
          key={item.buttonKey}
          button={item}
          defaultClassName="text-secondary hover:text-accent-primary"
          realMessageIndex={realMessageIndex}
        />
      ))}
      {onRegenerate && (
        <Tooltip placement="top" isTriggerClickable tooltip={t('Regenerate')}>
          <Button
            onClick={onRegenerate}
            data-qa="regenerate"
            className="text-secondary"
          >
            <IconRefresh size={18} />
          </Button>
        </Tooltip>
      )}
      {message.content.trim() &&
        (messageCopied ? (
          <Tooltip key="copied" placement="top" tooltip={t('Text copied')}>
            <IconCheck size={18} className="text-secondary" />
          </Tooltip>
        ) : (
          <Tooltip
            key="copy"
            placement="top"
            isTriggerClickable
            tooltip={t('Copy text')}
          >
            <Button className="text-secondary" onClick={copyOnClick}>
              <IconCopy size={18} />
            </Button>
          </Tooltip>
        ))}
      {onToggleEditing && (
        <Tooltip placement="top" isTriggerClickable tooltip={t('Edit')}>
          <Button
            onClick={onToggleEditing}
            data-qa="edit"
            className="text-secondary"
          >
            <IconEdit size={18} />
          </Button>
        </Tooltip>
      )}
      {isLikesEnabled &&
        (message.content.trim() || !!getMessageCustomContent(message)) && (
          <div className="flex flex-row gap-2">
            {message.like !== LikeState.Disliked && (
              <Tooltip
                placement="top"
                isTriggerClickable={message.like !== LikeState.Liked}
                tooltip={
                  message.like !== LikeState.Liked ? t('Like') : t('Liked')
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
                      ? 'text-secondary'
                      : 'text-accent-primary'
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
                tooltip={t(
                  message.like !== LikeState.Disliked ? 'Dislike' : 'Disliked',
                )}
              >
                <Button
                  onClick={() => {
                    if (message.like !== LikeState.NoState) {
                      onLike(LikeState.Disliked);
                    }
                  }}
                  className={
                    message.like !== LikeState.Disliked
                      ? 'text-secondary'
                      : 'text-accent-primary'
                  }
                  disabled={message.like === LikeState.Disliked}
                  data-qa="dislike"
                >
                  <IconThumbDown size={18} />
                </Button>
              </Tooltip>
            )}
          </div>
        )}
    </div>
  );
};

interface MessageMobileButtonsProps {
  message: Message;
  realMessageIndex: number;
  messageCopied: boolean;
  editDisabled: boolean;
  isEditing: boolean;
  isEditTemplatesAvailable: boolean;
  isLastMessage: boolean;
  isLikesEnabled: boolean;
  isMessageStreaming: boolean;
  isConversationInvalid: boolean;
  onLike: (likeStatus: LikeState) => void;
  onDelete?: () => void;
  onToggleEditing: (value: boolean) => void;
  onToggleTemplatesEditing: () => void;
  onCopy: () => void;
  onRegenerate?: () => void;
}

export const MessageMobileButtons = ({
  messageCopied,
  editDisabled,
  message,
  realMessageIndex,
  isLikesEnabled,
  isEditing,
  isEditTemplatesAvailable,
  isLastMessage,
  isMessageStreaming,
  isConversationInvalid,
  onLike,
  onDelete,
  onToggleEditing,
  onToggleTemplatesEditing,
  onCopy,
  onRegenerate,
}: MessageMobileButtonsProps) => {
  const { t } = useTranslation(Translation.Chat);

  const isConversationsWithSchema = useAppSelector(
    ConversationsSelectors.selectIsSelectedConversationsWithSchema,
  );
  const isEditLastMessageEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.EditLastAssistantContent),
  );
  const isAllLastMessageEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.EditAllAssistantContent),
  );

  const isAssistant = message.role === Role.Assistant;
  const customMessageButtons = useAppSelector((state) =>
    OverlaySelectors.selectPrependedDefaultButtonsForMessage(
      state,
      realMessageIndex,
    ),
  );

  if (isAssistant) {
    return (
      !(isMessageStreaming && isLastMessage) &&
      !isConversationInvalid && (
        <>
          {customMessageButtons?.map((item) => (
            <MenuItem
              key={item.buttonKey}
              isChildrenButton
              item={
                <OverlayMessageCustomButton
                  button={item}
                  realMessageIndex={realMessageIndex}
                />
              }
            />
          ))}
          {message.content.trim() &&
            (messageCopied ? (
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
                    {t('Copy')}
                  </div>
                }
                onClick={onCopy}
              />
            ))}
          {(isAllLastMessageEnabled ||
            (isLastMessage && isEditLastMessageEnabled)) && (
            <MenuItem
              item={
                <div className="flex items-center gap-3">
                  <IconEdit className="text-secondary" size={18} />
                  {t('Edit')}
                </div>
              }
              data-qa="edit"
              onClick={() => onToggleEditing(true)}
            />
          )}
          {onRegenerate && (
            <MenuItem
              item={
                <div className="flex items-center gap-3">
                  <IconRefresh className="text-secondary" size={18} />
                  {t('Regenerate')}
                </div>
              }
              data-qa="regenerate"
              onClick={onRegenerate}
            />
          )}
          {isLikesEnabled &&
            (message.content.trim() || !!getMessageCustomContent(message)) && (
              <>
                {message.like !== LikeState.Disliked && (
                  <MenuItem
                    className={classNames(
                      message.like !== LikeState.Liked &&
                        'hover:bg-accent-primary-alpha',
                    )}
                    item={
                      <div className="flex items-center gap-3">
                        <IconThumbUp className="text-secondary" size={18} />
                        <p
                          className={classNames(
                            message.like === LikeState.Liked &&
                              'text-secondary',
                          )}
                        >
                          {message.like === LikeState.Liked
                            ? t('Liked')
                            : t('Like')}
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
                      <div className="flex items-center gap-3">
                        <IconThumbDown className="text-secondary" size={18} />
                        <p
                          className={classNames(
                            message.like === LikeState.Disliked &&
                              'text-secondary',
                          )}
                        >
                          {message.like === LikeState.Disliked
                            ? t('Disliked')
                            : t('Dislike')}
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
            )}
        </>
      )
    );
  }

  return (
    !isMessageStreaming &&
    !isConversationInvalid && (
      <>
        {customMessageButtons?.map((item) => (
          <MenuItem
            key={item.buttonKey}
            isChildrenButton
            item={
              <OverlayMessageCustomButton
                button={item}
                defaultClassName="hover:bg-accent-primary-alpha focus:visible disabled:cursor-not-allowed group-hover:visible"
                defaultIconClassName="text-secondary"
                realMessageIndex={realMessageIndex}
              />
            }
          />
        ))}
        {isEditTemplatesAvailable && !isConversationsWithSchema && (
          <MenuItem
            className="hover:bg-accent-primary-alpha focus:visible disabled:cursor-not-allowed group-hover:visible"
            onClick={() => onToggleTemplatesEditing()}
            item={
              <div className="flex items-center gap-3 whitespace-nowrap">
                <IconListDetails
                  className="text-secondary"
                  size={18}
                  height={18}
                  width={18}
                />
                <p className="whitespace-nowrap">{t('Set template')}</p>
              </div>
            }
          />
        )}
        {!editDisabled && (
          <MenuItem
            className="hover:bg-accent-primary-alpha focus:visible disabled:cursor-not-allowed group-hover:visible"
            onClick={() => onToggleEditing(!isEditing)}
            item={
              <div className="flex items-center gap-3">
                <IconEdit className="text-secondary" size={18} />
                <p>{t('Edit')}</p>
              </div>
            }
          />
        )}
        {onDelete && (
          <MenuItem
            className="hover:bg-accent-primary-alpha focus:visible group-hover:visible"
            onClick={onDelete}
            item={
              <div className="flex items-center gap-3">
                <IconTrashX className="text-secondary" size={18} />
                <p>{t('Delete')}</p>
              </div>
            }
          />
        )}
      </>
    )
  );
};
