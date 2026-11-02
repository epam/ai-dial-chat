import { formatFileSize } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { useAppConfig } from '../../context/AppConfigContext';

/**
 * Returns the configured maximum upload size (`FILE_UPLOAD_MAX_BYTES`, served
 * as `maxAttachmentFileSizeBytes`) formatted for display, or `undefined` when
 * no positive limit is configured. Shared by the upload failure toast and the
 * failed upload-queue row so a `413` names the same limit the pre-upload check
 * enforces.
 */
export const useMaxUploadFileSizeLabel = (): string | undefined => {
  const {
    config: { maxAttachmentFileSizeBytes },
  } = useAppConfig();

  return useMemo(
    () =>
      maxAttachmentFileSizeBytes != null && maxAttachmentFileSizeBytes > 0
        ? formatFileSize(maxAttachmentFileSizeBytes)
        : undefined,
    [maxAttachmentFileSizeBytes],
  );
};
