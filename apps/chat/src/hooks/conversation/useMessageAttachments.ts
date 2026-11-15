import {
  attachmentDtosToDisplayAttachments,
  useAttachmentAction,
} from '@epam/ai-dial-chat-hooks';
import { type DisplayAttachment } from '@epam/ai-dial-chat-shared';
import {
  getReferenceAttachmentGroups,
  isReferenceOnlyAttachment,
} from '@epam/ai-dial-quotations';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConversationMessageItemProps } from '../../components/ConversationView/ConversationMessageItem';
import {
  AttachmentsI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import { attachmentDisplayResolvers } from '../../utils/attachment-display-resolvers';
import { resolveDialFileDownloadUrl } from '../../utils/dial-file';

type UseMessageAttachmentsParams = Pick<
  ConversationMessageItemProps,
  'msg' | 'index' | 'onAttachmentClick' | 'selectedAttachmentKey'
>;

/**
 * Attachment handling for one message: the click and download handlers and
 * their labels, the message's reference groups and display-attachment
 * lists, and which of its attachments is open in the canvas (the canvas key
 * is message-scoped, so the `${index}:` prefix is stripped). Reads the i18n
 * context itself.
 */
export const useMessageAttachments = ({
  msg,
  index,
  onAttachmentClick: onAttachmentClickProp,
  selectedAttachmentKey,
}: UseMessageAttachmentsParams) => {
  const { t } = useTranslation();

  const { handleAttachmentClick: handleDownload } = useAttachmentAction({
    resolveDownloadUrl: resolveDialFileDownloadUrl,
  });
  const handleIndexedAttachmentClick = useCallback(
    (attachment: DisplayAttachment) =>
      onAttachmentClickProp?.(attachment, index),
    [onAttachmentClickProp, index],
  );
  const handleAttachmentClick = onAttachmentClickProp
    ? handleIndexedAttachmentClick
    : handleDownload;
  /*
   * A file tile and its corner download button are separate controls, so they
   * need separate names. The tile only downloads when no host click handler
   * is given; otherwise it opens the attachment in the canvas.
   */
  const attachmentClickLabel = onAttachmentClickProp
    ? t(ButtonsI18nKeys.OpenInCanvas)
    : t(AttachmentsI18nKeys.Download);
  const attachmentDownloadLabel = t(AttachmentsI18nKeys.Download);
  const handleDownloadAll = useCallback(
    (attachmentsToDownload: DisplayAttachment[]) => {
      attachmentsToDownload.forEach(handleDownload);
    },
    [handleDownload],
  );

  const referenceGroups = useMemo(
    () => getReferenceAttachmentGroups(msg.custom_content?.attachments),
    [msg.custom_content?.attachments],
  );
  const allDisplayAttachments = useMemo(
    () =>
      attachmentDtosToDisplayAttachments(
        msg.custom_content?.attachments,
        attachmentDisplayResolvers,
      ),
    [msg.custom_content?.attachments],
  );
  const nonReferenceDisplayAttachments = useMemo(
    () =>
      attachmentDtosToDisplayAttachments(
        msg.custom_content?.attachments?.filter(
          (a) => !isReferenceOnlyAttachment(a),
        ),
        attachmentDisplayResolvers,
      ),
    [msg.custom_content?.attachments],
  );

  const selectedAttachmentKeyPrefix = `${index}:`;
  const selectedAttachmentId = selectedAttachmentKey?.startsWith(
    selectedAttachmentKeyPrefix,
  )
    ? selectedAttachmentKey.slice(selectedAttachmentKeyPrefix.length)
    : undefined;

  return {
    handleAttachmentClick,
    attachmentClickLabel,
    attachmentDownloadLabel,
    handleDownloadAll,
    referenceGroups,
    allDisplayAttachments,
    nonReferenceDisplayAttachments,
    selectedAttachmentId,
  };
};
