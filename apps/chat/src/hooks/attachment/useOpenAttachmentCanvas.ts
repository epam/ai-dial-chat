import {
  createUnsupportedCanvasContent,
  isTextPreviewable,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  AttachmentType,
  type DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import {
  resolveImageCanvasContent,
  resolveJsonCanvasContent,
  resolveMarkdownCanvasContent,
  resolveTextCanvasContent,
} from '../../utils/attachment-canvas';

/**
 * Returns `openAttachmentCanvas`, an async function that opens the attachment
 * canvas for a given attachment. Returns `true` if the canvas was opened,
 * `false` if the attachment type is not previewable (caller may fall back to
 * downloading).
 */
export const useOpenAttachmentCanvas = () => {
  const { openCanvas } = useAttachmentCanvas();

  const openAttachmentCanvas = useCallback(
    async (attachment: DisplayAttachment): Promise<boolean> => {
      switch (attachment.type) {
        case AttachmentType.Image: {
          const content = await resolveImageCanvasContent(attachment);
          if (content == null) return false;
          openCanvas(content, attachment.name);
          return true;
        }
        case AttachmentType.File: {
          const contentType = attachment.contentType.toLowerCase();

          if (contentType === 'text/markdown') {
            const content = await resolveMarkdownCanvasContent(attachment);
            openCanvas(
              content ?? createUnsupportedCanvasContent(),
              attachment.name,
            );
            return true;
          }
          if (contentType === 'application/json') {
            const content = await resolveJsonCanvasContent(attachment);
            openCanvas(
              content ?? createUnsupportedCanvasContent(),
              attachment.name,
            );
            return true;
          }

          const fileName = attachment.name ?? '';
          const dotIdx = fileName.lastIndexOf('.');
          const ext =
            dotIdx !== -1 ? fileName.slice(dotIdx + 1).toLowerCase() : '';

          if (ext === 'md' || ext === 'markdown') {
            const content = await resolveMarkdownCanvasContent(attachment);
            if (content == null) return false;
            openCanvas(content, attachment.name);
            return true;
          }
          if (ext === 'json') {
            const content = await resolveJsonCanvasContent(attachment);
            if (content == null) return false;
            openCanvas(content, attachment.name);
            return true;
          }
          if (attachment.name != null && !isTextPreviewable(attachment.name)) {
            openCanvas(createUnsupportedCanvasContent(), attachment.name);
            return true;
          }
          const content = await resolveTextCanvasContent(attachment);
          if (content == null) return false;
          openCanvas(content, attachment.name);
          return true;
        }
        case AttachmentType.Pasted:
        case AttachmentType.Prompt: {
          const content = await resolveTextCanvasContent(attachment);
          if (content == null) return false;
          openCanvas(content, attachment.name);
          return true;
        }
        default:
          return false;
      }
    },
    [openCanvas],
  );

  return { openAttachmentCanvas };
};
