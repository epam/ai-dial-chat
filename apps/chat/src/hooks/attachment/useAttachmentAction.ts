import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import {
  isDialFileId,
  resolveDialFileDownloadUrl,
} from '../../utils/dial-file';

export const useAttachmentAction = () => {
  const handleAttachmentClick = useCallback(
    (attachment: DisplayAttachment): void => {
      const { url } = attachment;
      if (url == null || !isDialFileId(url)) return;

      const downloadUrl = resolveDialFileDownloadUrl(url);
      if (downloadUrl == null) return;

      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = attachment.name;
      anchor.click();
    },
    [],
  );

  return { handleAttachmentClick };
};
