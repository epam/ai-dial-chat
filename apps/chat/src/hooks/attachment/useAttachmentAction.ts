import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import {
  base64ToBlob,
  type DisplayAttachment,
  MIMEType,
  triggerAnchorDownload,
  triggerBlobDownload,
} from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import { openAnnotationAttachment } from '../../utils/annotation';
import { referenceAttachmentToPdfCanvasContent } from '../../utils/attachment-canvas';
import {
  isDialFileId,
  resolveDialFileDownloadUrl,
} from '../../utils/dial-file';

/** Returns true when `downloadAttachment` can trigger a download for `attachment`. */
export const isDownloadableAttachment = (
  attachment: DisplayAttachment,
): boolean =>
  (attachment.url != null && isDialFileId(attachment.url)) ||
  attachment.data != null;

/**
 * Downloads an attachment that carries its own content: a DIAL-hosted file
 * (`url` resolves to a DIAL file id) or an inline `data` payload. Returns
 * whether a download was actually triggered, so callers can skip
 * non-downloadable (reference-only) attachments without duplicating the
 * DIAL-file-id / URL-resolution checks.
 */
export const downloadAttachment = (attachment: DisplayAttachment): boolean => {
  const { url, name, contentType, data } = attachment;

  if (url != null && isDialFileId(url)) {
    const downloadUrl = resolveDialFileDownloadUrl(url);
    if (downloadUrl == null) return false;

    triggerAnchorDownload(downloadUrl, name);
    return true;
  }

  /* Generated attachments (e.g. a produced .md report) can arrive inline in
   * `data` rather than as a DIAL file, in which case there is no download URL
   * to resolve — build the blob locally instead. */
  if (data != null) {
    triggerBlobDownload(
      base64ToBlob(data, contentType || MIMEType.Plain),
      name,
    );
    return true;
  }

  return false;
};

/**
 * Default click behavior for a plain attachment tile: downloads DIAL-hosted
 * and inline (`data`) files, and for reference-only attachments (no `url`/`data`,
 * only `referenceUrl` — e.g. RAG/search-grounding chunks), opens a PDF
 * `referenceUrl` in the canvas scrolled to its referenced page when present,
 * otherwise opens/downloads the `referenceUrl` as-is.
 */
export const useAttachmentAction = () => {
  const { openCanvas } = useAttachmentCanvas();

  const handleAttachmentClick = useCallback(
    (attachment: DisplayAttachment): void => {
      const { url, referenceUrl, data, name } = attachment;

      if (url != null || data != null) {
        downloadAttachment(attachment);
        return;
      }

      if (referenceUrl == null) return;

      const canvasContent = referenceAttachmentToPdfCanvasContent({
        type: attachment.contentType,
        url: referenceUrl,
        title: name,
      });
      if (canvasContent) {
        openCanvas(canvasContent, name);
        return;
      }

      openAnnotationAttachment({
        type: attachment.contentType,
        url: referenceUrl,
        title: name,
      });
    },
    [openCanvas],
  );

  return { handleAttachmentClick };
};
