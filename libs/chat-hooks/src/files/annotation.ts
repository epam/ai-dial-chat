import {
  type AttachmentResource,
  ensureDownloadFilename,
  triggerAnchorDownload,
} from '@epam/ai-dial-chat-shared';
import type { ResolveDownloadUrl } from '../attachment/useAttachmentAction/useAttachmentAction';
import { isDialStoredFileId } from './dial-file';

/**
 * Opens a cited/referenced attachment: triggers a browser download for
 * DIAL-hosted files (`files/...` and project file ids) via the injected
 * `resolveDownloadUrl`, otherwise opens the URL in a new tab. No-ops when the
 * attachment has no URL or the download URL cannot be resolved.
 */
export const openAnnotationAttachment = (
  attachment: AttachmentResource,
  resolveDownloadUrl: ResolveDownloadUrl,
): void => {
  const { url } = attachment;
  if (url == null) return;

  const fileId = url.split('#')[0];
  if (isDialStoredFileId(fileId)) {
    const downloadUrl = resolveDownloadUrl(fileId);
    if (downloadUrl == null) return;
    const displayName = attachment.title ?? fileId.split('/').pop() ?? '';
    triggerAnchorDownload(
      downloadUrl,
      ensureDownloadFilename(displayName, fileId, attachment.type),
    );
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
