import {
  isMimeTypeAllowed,
  mimeTypesToExtensionLabels,
} from '@epam/ai-dial-attachment-input';
import {
  AttachmentErrorReason,
  type Attachment,
  type DeploymentItem,
} from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentsI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';

export const useAttachmentValidation = (
  selectedDeployment: DeploymentItem | undefined,
) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();

  const inputAttachmentTypes = useMemo(
    () => selectedDeployment?.inputAttachmentTypes ?? [],
    [selectedDeployment],
  );

  const isAttachmentsAllowed =
    selectedDeployment?.inputAttachmentTypes != null &&
    selectedDeployment.inputAttachmentTypes.length > 0;

  const unsupportedTypeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const validateAttachment = useCallback(
    (attachment: Attachment): AttachmentErrorReason | undefined => {
      if (!isMimeTypeAllowed(attachment.contentType, inputAttachmentTypes)) {
        if (unsupportedTypeTimerRef.current != null) {
          clearTimeout(unsupportedTypeTimerRef.current);
        }
        unsupportedTypeTimerRef.current = setTimeout(() => {
          const noTypesAllowed = inputAttachmentTypes.length === 0;
          showNotification({
            variant: NotificationVariant.Error,
            title: t(
              noTypesAllowed
                ? AttachmentsI18nKeys.NoAttachmentsAllowedTitle
                : AttachmentsI18nKeys.UnsupportedTypeTitle,
            ),
            message: t(
              noTypesAllowed
                ? AttachmentsI18nKeys.NoAttachmentsAllowedMessage
                : AttachmentsI18nKeys.UnsupportedTypeMessage,
              noTypesAllowed
                ? undefined
                : { formats: mimeTypesToExtensionLabels(inputAttachmentTypes) },
            ),
          });
          unsupportedTypeTimerRef.current = null;
        }, 100);
        return AttachmentErrorReason.UnsupportedType;
      }
      return undefined;
    },
    [inputAttachmentTypes, showNotification, t],
  );

  return { inputAttachmentTypes, isAttachmentsAllowed, validateAttachment };
};
