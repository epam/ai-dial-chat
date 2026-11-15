import { MessageBubble } from '@epam/ai-dial-conversation-messages';
import { FC, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AttachmentsI18nKeys,
  ChatI18nKeys,
} from '../../../constants/translation-keys';
import type { useMessageAttachments } from '../../../hooks/conversation/useMessageAttachments';
import type { useMessageCitations } from '../../../hooks/conversation/useMessageCitations';
import { isAttachmentDownloadable } from '../../../utils/dial-file';
import type { ConversationMessageItemProps } from '../ConversationMessageItem';

const EditMessageInput = lazy(async () => {
  const module = await import('@epam/ai-dial-conversation-input');
  return { default: module.EditMessageInput };
});

interface MessageEditModeProps extends Pick<
  ConversationMessageItemProps,
  | 'msg'
  | 'index'
  | 'cancelLabel'
  | 'saveLabel'
  | 'editMessageAriaLabel'
  | 'showMoreLabel'
  | 'showLessLabel'
  | 'showMoreUserMessageAriaLabel'
  | 'showLessUserMessageAriaLabel'
  | 'renderHistorySkillSegments'
  | 'editMessage'
  | 'editMessageRevision'
  | 'editActiveMentions'
  | 'onEditBackspaceAtCaret'
  | 'editCaretPositionOverride'
  | 'onEditDraftChange'
  | 'editCommandMenu'
  | 'editMenuOverlays'
  | 'editSendOnEnter'
  | 'onCancelEdit'
  | 'onEditMessage'
  | 'onUploadAttachment'
  | 'pendingDropFiles'
  | 'onDropFilesConsumed'
  | 'validateAttachment'
  | 'isAttachmentsEnabled'
  | 'isTextAttachmentsAllowed'
  | 'maximumAttachmentsAmount'
  | 'onAttachmentsLimitExceeded'
  | 'hideAttachFile'
  | 'fileAccept'
  | 'onDialFileSystemClick'
  | 'dialFileSystemLabel'
  | 'pendingAttachments'
  | 'onPendingAttachmentsConsumed'
  | 'onMessageTooLong'
> {
  messageTextStyles: ReturnType<
    typeof useMessageCitations
  >['messageTextStyles'];
  allDisplayAttachments: ReturnType<
    typeof useMessageAttachments
  >['allDisplayAttachments'];
  attachmentClickLabel: ReturnType<
    typeof useMessageAttachments
  >['attachmentClickLabel'];
  attachmentDownloadLabel: ReturnType<
    typeof useMessageAttachments
  >['attachmentDownloadLabel'];
  handleAttachmentClick: ReturnType<
    typeof useMessageAttachments
  >['handleAttachmentClick'];
  handleDownloadAll: ReturnType<
    typeof useMessageAttachments
  >['handleDownloadAll'];
}

/**
 * A user message being edited: the lazily loaded `EditMessageInput`, with
 * the read-only bubble as its suspense fallback. Presentational and private
 * to `ConversationMessageItem`; rendered from its edit branch, after all of
 * the item's hooks have run.
 */
const MessageEditMode: FC<MessageEditModeProps> = ({
  msg,
  index,
  cancelLabel,
  saveLabel,
  editMessageAriaLabel,
  showMoreLabel,
  showLessLabel,
  showMoreUserMessageAriaLabel,
  showLessUserMessageAriaLabel,
  renderHistorySkillSegments,
  editMessage,
  editMessageRevision,
  editActiveMentions,
  onEditBackspaceAtCaret,
  editCaretPositionOverride,
  onEditDraftChange,
  editCommandMenu,
  editMenuOverlays,
  editSendOnEnter,
  onCancelEdit,
  onEditMessage,
  onUploadAttachment,
  pendingDropFiles,
  onDropFilesConsumed,
  validateAttachment,
  isAttachmentsEnabled,
  isTextAttachmentsAllowed,
  maximumAttachmentsAmount,
  onAttachmentsLimitExceeded,
  hideAttachFile,
  fileAccept,
  onDialFileSystemClick,
  dialFileSystemLabel,
  pendingAttachments,
  onPendingAttachmentsConsumed,
  onMessageTooLong,
  messageTextStyles,
  allDisplayAttachments,
  attachmentClickLabel,
  attachmentDownloadLabel,
  handleAttachmentClick,
  handleDownloadAll,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-end">
      <Suspense
        fallback={
          <MessageBubble
            role={msg.role}
            text={msg.content}
            textSegments={
              renderHistorySkillSegments?.(
                msg.content,
                msg.custom_content?.skills,
              ) ?? undefined
            }
            styles={{ ...messageTextStyles, className: 'justify-end' }}
            attachments={allDisplayAttachments}
            labels={{
              userMessageAriaLabel: t(ChatI18nKeys.UserMessageAriaLabel),
              showMoreLabel,
              showLessLabel,
              showMoreAriaLabel: showMoreUserMessageAriaLabel,
              showLessAriaLabel: showLessUserMessageAriaLabel,
              attachmentClickLabel,
              attachmentDownloadLabel,
              attachmentOpenInNewTabLabel: t(AttachmentsI18nKeys.OpenInNewTab),
            }}
            onAttachmentClick={handleAttachmentClick}
            onDownloadAll={handleDownloadAll}
            isAttachmentDownloadable={isAttachmentDownloadable}
          />
        }
      >
        <EditMessageInput
          message={editMessage ?? msg.content}
          messageRevision={editMessageRevision}
          initialAttachments={allDisplayAttachments}
          onCancel={() => onCancelEdit?.(index)}
          onSave={(text, kept, added) =>
            onEditMessage?.(index, text, kept, added)
          }
          onUploadAttachment={onUploadAttachment}
          cancelLabel={cancelLabel}
          removeLabel={t(AttachmentsI18nKeys.RemoveLabel)}
          retryLabel={t(AttachmentsI18nKeys.RetryLabel)}
          uploadingLabel={t(AttachmentsI18nKeys.UploadingLabel)}
          expandLabel={t(AttachmentsI18nKeys.ExpandPastedText)}
          clickLabel={attachmentClickLabel}
          saveLabel={saveLabel}
          ariaLabel={editMessageAriaLabel}
          className="w-full max-w-[748px]"
          pendingDropFiles={pendingDropFiles}
          onDropFilesConsumed={onDropFilesConsumed}
          validateAttachment={validateAttachment}
          isAttachmentsEnabled={isAttachmentsEnabled}
          isTextAttachmentsAllowed={isTextAttachmentsAllowed}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onAttachmentsLimitExceeded={onAttachmentsLimitExceeded}
          hideAttachFile={hideAttachFile}
          fileAccept={fileAccept}
          onDialFileSystemClick={onDialFileSystemClick}
          dialFileSystemLabel={dialFileSystemLabel}
          pendingAttachments={pendingAttachments}
          onPendingAttachmentsConsumed={onPendingAttachmentsConsumed}
          onAttachmentClick={handleAttachmentClick}
          onMessageTooLong={onMessageTooLong}
          activeMentions={editActiveMentions}
          onBackspaceAtCaret={onEditBackspaceAtCaret}
          caretPositionOverride={editCaretPositionOverride}
          onChange={onEditDraftChange}
          commandMenu={editCommandMenu}
          menuOverlays={editMenuOverlays}
          sendOnEnter={editSendOnEnter}
        />
      </Suspense>
    </div>
  );
};

export default MessageEditMode;
