import {
  type AttachmentResource,
  triggerAnchorDownload,
} from '@epam/ai-dial-chat-shared';
import type { ResolveDownloadUrl } from '../attachment/useAttachmentAction/useAttachmentAction';
import { isDialFileId } from './dial-file';

/**
 * Opens a cited/referenced attachment: triggers a browser download for
 * DIAL-hosted files (`files/...` ids) via the injected `resolveDownloadUrl`,
 * otherwise opens the URL in a new tab. No-ops when the attachment has no
 * URL or the download URL cannot be resolved.
 */
export const openAnnotationAttachment = (
  attachment: AttachmentResource,
  resolveDownloadUrl: ResolveDownloadUrl,
): void => {
  const { url } = attachment;
  if (url == null) return;

  const fileId = url.split('#')[0];
  if (isDialFileId(fileId)) {
    const downloadUrl = resolveDownloadUrl(fileId);
    if (downloadUrl == null) return;
    triggerAnchorDownload(
      downloadUrl,
      attachment.title ?? fileId.split('/').pop() ?? '',
    );
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
