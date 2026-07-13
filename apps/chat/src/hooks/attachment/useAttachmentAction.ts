import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import { openAnnotationAttachment } from '../../utils/annotation';
import { referenceAttachmentToPdfCanvasContent } from '../../utils/attachment-canvas';
import {
  isDialFileId,
  resolveDialFileDownloadUrl,
} from '../../utils/dial-file';

/**
 * Default click behavior for a plain attachment tile: downloads DIAL-hosted
 * files, and for reference-only attachments (no `url`, only `referenceUrl` —
 * e.g. RAG/search-grounding chunks), opens a PDF `referenceUrl` in the canvas
 * scrolled to its referenced page when present, otherwise opens/downloads the
 * `referenceUrl` as-is.
 */
export const useAttachmentAction = () => {
  const { openCanvas } = useAttachmentCanvas();

  const handleAttachmentClick = useCallback(
    (attachment: DisplayAttachment): void => {
      const { url, referenceUrl, name } = attachment;

      if (url != null) {
        if (!isDialFileId(url)) return;
        const downloadUrl = resolveDialFileDownloadUrl(url);
        if (downloadUrl == null) return;
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = name;
        anchor.click();
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
