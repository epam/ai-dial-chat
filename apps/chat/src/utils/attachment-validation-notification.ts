import {
  AttachmentValidationErrorReason,
  type AttachmentValidationErrorEvent,
} from '@epam/ai-dial-chat-hooks';
import { formatFileSize } from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import { AttachmentsI18nKeys } from '../constants/translation-keys';

/** Error notification copy for an attachment rejected by `useAttachmentValidation`. */
export const buildAttachmentValidationNotification = (
  { reason, formats, maxFileSizeBytes }: AttachmentValidationErrorEvent,
  t: TFunction,
): { title: string; message: string } => {
  if (reason === AttachmentValidationErrorReason.FileTooLarge) {
    return {
      title: t(AttachmentsI18nKeys.FileTooLargeTitle),
      message: t(AttachmentsI18nKeys.FileTooLargeMessage, {
        maxSize:
          maxFileSizeBytes != null ? formatFileSize(maxFileSizeBytes) : '',
      }),
    };
  }

  const noTypesAllowed =
    reason === AttachmentValidationErrorReason.NoTypesAllowed;
  return {
    title: t(
      noTypesAllowed
        ? AttachmentsI18nKeys.NoAttachmentsAllowedTitle
        : AttachmentsI18nKeys.UnsupportedTypeTitle,
    ),
    message: t(
      noTypesAllowed
        ? AttachmentsI18nKeys.NoAttachmentsAllowedMessage
        : AttachmentsI18nKeys.UnsupportedTypeMessage,
      noTypesAllowed ? undefined : { formats },
    ),
  };
};
