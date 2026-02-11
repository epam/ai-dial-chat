import {
  Icon,
  IconCheck,
  IconCopy,
  IconEdit,
  IconListDetails,
  IconMarkdown,
  IconRefresh,
  IconTrashX,
} from '@tabler/icons-react';

import classNames from 'classnames';

import { useCopy } from '@/src/hooks/useCopy';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getMessageCustomContent } from '@/src/utils/app/conversation';

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
import { MessageLikes } from './MessageLikes';

import {
  Feature,
  Message,
  Role,
  onLikeMessageHandler,
} from '@epam/ai-dial-shared';
import {
  ButtonAppearance,
  ButtonSize,
  DialPrimaryIconButton,
} from '@epam/ai-dial-ui-kit';

interface MessageUserButtonsProps {
  realMessageIndex: number;
  isEditAvailable: boolean;
  isMessageStreaming: boolean;
  isEditTemplatesAvailable: boolean;
  onToggleEditing: () => void;
  message: Message;
  onDelete?: () => void;
  onToggleTemplatesEditing: () => void;
}

export const MessageUserButtons = ({
  message,
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
              <DialPrimaryIconButton
                appearance={ButtonAppearance.Ghost}
                size={ButtonSize.Small}
                onClick={onToggleTemplatesEditing}
                icon={<IconListDetails size={16} stroke={1.5} />}
              />
            </Tooltip>
          )}
          {isEditAvailable && (
            <Tooltip placement="top" isTriggerClickable tooltip={t('Edit')}>
              <DialPrimaryIconButton
                appearance={ButtonAppearance.Ghost}
                size={ButtonSize.Small}
                onClick={onToggleEditing}
                icon={<IconEdit size={16} stroke={1.5} />}
              />
            </Tooltip>
          )}
          <CopyButton
            content={message.content}
            copyLabel="Copy text"
            copiedLabel="Text copied"
            convertFromMarkdown
          />
          <CopyButton
            content={message.content}
            copyLabel="Copy markdown"
            copiedLabel="Markdown copied"
            Icon={IconMarkdown}
          />
          {onDelete && (
            <Tooltip placement="top" isTriggerClickable tooltip={t('Delete')}>
              {/* TODO change to the DialRemoveButton when will be fixed on AI DIAL UI KIT */}
              <DialPrimaryIconButton
                appearance={ButtonAppearance.Ghost}
                size={ButtonSize.Small}
                onClick={onDelete}
                icon={<IconTrashX size={16} stroke={1.5} />}
              />
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
};

interface CopyButtonProps {
  keyPostfix?: string;
  content: string;
  convertFromMarkdown?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  Icon?: Icon;
}
const CopyButton = ({
  keyPostfix = '',
  content,
  convertFromMarkdown = false,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  Icon = IconCopy,
}: CopyButtonProps) => {
  const { t } = useTranslation(Translation.Chat);

  const { copied, onCopy } = useCopy(content, convertFromMarkdown);

  return (
    <Tooltip
      key={`${copied ? 'copied' : 'copy'}${keyPostfix}`}
      placement="top"
      isTriggerClickable
      tooltip={t(copied ? copiedLabel : copyLabel)}
    >
      <DialPrimaryIconButton
        appearance={ButtonAppearance.Ghost}
        size={ButtonSize.Small}
        onClick={onCopy}
        disabled={copied}
        icon={
          copied ? (
            <IconCheck size={18} className="text-secondary" />
          ) : (
            <Icon size={18} stroke={1.5} />
          )
        }
      />
    </Tooltip>
  );
};

interface MessageAssistantButtonsProps {
  realMessageIndex: number;
  isLikesEnabled: boolean;
  message: Message;
  onLike?: onLikeMessageHandler;
  onRegenerate?: () => void;
  onToggleEditing?: () => void;
}

export const MessageAssistantButtons = ({
  message,
  realMessageIndex,
  isLikesEnabled,
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

  const hasMessageContent = !!message.content.trim();

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
          <DialPrimaryIconButton
            appearance={ButtonAppearance.Ghost}
            size={ButtonSize.Small}
            onClick={onRegenerate}
            icon={<IconRefresh size={16} stroke={1.5} />}
            data-qa="regenerate"
          />
        </Tooltip>
      )}
      {hasMessageContent && (
        <>
          <CopyButton
            content={message.content}
            copyLabel="Copy text"
            copiedLabel="Text copied"
            convertFromMarkdown
          />
          <CopyButton
            content={message.content}
            copyLabel="Copy markdown"
            copiedLabel="Markdown copied"
            Icon={IconMarkdown}
          />
        </>
      )}
      {onToggleEditing && (
        <Tooltip placement="top" isTriggerClickable tooltip={t('Edit')}>
          <DialPrimaryIconButton
            appearance={ButtonAppearance.Ghost}
            size={ButtonSize.Small}
            onClick={onToggleEditing}
            data-qa="edit"
            icon={<IconEdit size={16} stroke={1.5} />}
          />
        </Tooltip>
      )}
      {isLikesEnabled &&
        onLike &&
        (hasMessageContent || !!getMessageCustomContent(message)) && (
          <div className="flex flex-row gap-2">
            <MessageLikes likeStatus={message.like} onLike={onLike} />
          </div>
        )}
    </div>
  );
};

const MobileCopyButton = ({
  keyPostfix = '',
  content,
  convertFromMarkdown = false,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  Icon = IconCopy,
}: CopyButtonProps) => {
  const { t } = useTranslation(Translation.Chat);

  const { copied, onCopy } = useCopy(content, convertFromMarkdown);
  if (copied) {
    return (
      <MenuItem
        key={`copy${keyPostfix}`}
        item={
          <div className="flex items-center gap-3 text-nowrap">
            <IconCheck size={20} className="text-secondary" />
            <p>{t(copiedLabel)}</p>
          </div>
        }
      />
    );
  }

  return (
    <MenuItem
      className="hover:bg-accent-primary-alpha"
      item={
        <div className="flex items-center gap-3 text-nowrap">
          <Icon className="text-secondary" size={18} />
          {t(copyLabel)}
        </div>
      }
      onClick={onCopy}
    />
  );
};

interface MessageMobileButtonsProps {
  message: Message;
  realMessageIndex: number;
  editDisabled: boolean;
  isEditing: boolean;
  isEditTemplatesAvailable: boolean;
  isLastMessage: boolean;
  isLikesEnabled: boolean;
  isMessageStreaming: boolean;
  isConversationInvalid: boolean;
  onLike: onLikeMessageHandler;
  onDelete?: () => void;
  onToggleEditing: (value: boolean) => void;
  onToggleTemplatesEditing: () => void;
  onRegenerate?: () => void;
}

export const MessageMobileButtons = ({
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
  const isReadOnly = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsReadOnly,
  );

  const isAssistant = message.role === Role.Assistant;
  const customMessageButtons = useAppSelector((state) =>
    OverlaySelectors.selectPrependedDefaultButtonsForMessage(
      state,
      realMessageIndex,
    ),
  );

  const hasMessageContent = !!message.content.trim();

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
          {hasMessageContent && (
            <>
              <MobileCopyButton
                content={message.content}
                copyLabel="Copy text"
                copiedLabel="Copied text"
                convertFromMarkdown
              />
              <MobileCopyButton
                content={message.content}
                copyLabel="Copy markdown"
                copiedLabel="Copied markdown"
                Icon={IconMarkdown}
              />
            </>
          )}
          {!editDisabled &&
            onToggleEditing &&
            (isAllLastMessageEnabled ||
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
            (hasMessageContent || !!getMessageCustomContent(message)) && (
              <MessageLikes
                likeStatus={message.like}
                onLike={onLike}
                isMobile
              />
            )}
        </>
      )
    );
  }

  return (
    !isReadOnly &&
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
        <MobileCopyButton
          content={message.content}
          copyLabel="Copy text"
          copiedLabel="Copied text"
          convertFromMarkdown
        />
        <MobileCopyButton
          content={message.content}
          copyLabel="Copy markdown"
          copiedLabel="Copied markdown"
          Icon={IconMarkdown}
        />
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
