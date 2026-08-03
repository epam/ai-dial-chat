import { triggerAnchorDownload } from '@epam/ai-dial-chat-shared';
import type { AttachmentResource } from '@epam/ai-dial-quotations';
import { isDialFileId, resolveDialFileDownloadUrl } from './dial-file';

/**
 * Opens a cited/referenced attachment: triggers a browser download for
 * DIAL-hosted files (`files/...` ids), otherwise opens the URL in a new tab.
 * No-ops when the attachment has no URL or the download URL cannot be resolved.
 */
export const openAnnotationAttachment = (
  attachment: AttachmentResource,
): void => {
  const { url } = attachment;
  if (url == null) return;

  const fileId = url.split('#')[0];
  if (isDialFileId(fileId)) {
    const downloadUrl = resolveDialFileDownloadUrl(fileId);
    if (downloadUrl == null) return;
    triggerAnchorDownload(
      downloadUrl,
      attachment.title ?? fileId.split('/').pop() ?? '',
    );
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
