import {
  createLoadingCanvasContent,
  createUnsupportedCanvasContent,
  isTextPreviewable,
  useAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  AttachmentType,
  FileExtension,
  MIMEType,
  type DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import {
  referenceAttachmentToPdfCanvasContent,
  resolveImageCanvasContent,
  resolveJsonCanvasContent,
  resolveMarkdownCanvasContent,
  resolvePdfCanvasContent,
  resolveTextCanvasContent,
} from '../../utils/attachment-canvas';
import { resolveDialUrl } from '../../utils/dial-file';

type OpenCanvas = ReturnType<typeof useAttachmentCanvas>['openCanvas'];

/**
 * Shows the loading placeholder only when a DIAL file actually needs to be
 * fetched — the resolvers never return `null` once a DIAL URL exists (a
 * fetch failure becomes an `ErrorCanvasContent`, never `null`), and every
 * other source (local file, inline data, previewUrl) resolves synchronously
 * with no perceptible delay. So a placeholder is never left stranded: by the
 * time `content` can be `null`, one was never shown.
 */
function openLoadingPlaceholderIfFetching(
  attachment: DisplayAttachment,
  openCanvas: OpenCanvas,
): void {
  if (resolveDialUrl(attachment) != null) {
    openCanvas(createLoadingCanvasContent(), attachment.name);
  }
}

async function openFileCanvas(
  attachment: DisplayAttachment,
  openCanvas: OpenCanvas,
): Promise<boolean> {
  if (attachment.url == null && attachment.referenceUrl != null) {
    const pdfContent = referenceAttachmentToPdfCanvasContent({
      type: attachment.contentType,
      url: attachment.referenceUrl,
      title: attachment.name,
    });
    if (pdfContent != null) {
      openCanvas(pdfContent, attachment.name);
      return true;
    }
  }

  const contentType = attachment.contentType.toLowerCase();

  if (!contentType && attachment.data != null) {
    const content = await resolveTextCanvasContent(attachment);
    if (content != null) {
      openCanvas(content, attachment.name);
      return true;
    }
  }

  switch (contentType) {
    case MIMEType.PDF: {
      openLoadingPlaceholderIfFetching(attachment, openCanvas);
      const content = await resolvePdfCanvasContent(attachment);
      openCanvas(
        content ?? createUnsupportedCanvasContent(resolveDialUrl(attachment)),
        attachment.name,
      );
      return true;
    }
    case MIMEType.Markdown: {
      const content = await resolveMarkdownCanvasContent(attachment);
      openCanvas(
        content ?? createUnsupportedCanvasContent(resolveDialUrl(attachment)),
        attachment.name,
      );
      return true;
    }
    case MIMEType.JSON: {
      const content = await resolveJsonCanvasContent(attachment);
      openCanvas(
        content ?? createUnsupportedCanvasContent(resolveDialUrl(attachment)),
        attachment.name,
      );
      return true;
    }
  }

  const fileName = attachment.name ?? '';
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx !== -1 ? fileName.slice(dotIdx + 1).toLowerCase() : '';

  switch (ext) {
    case FileExtension.Markdown:
    case FileExtension.MarkdownAlt: {
      const content = await resolveMarkdownCanvasContent(attachment);
      if (content == null) return false;
      openCanvas(content, attachment.name);
      return true;
    }
    case FileExtension.JSON: {
      const content = await resolveJsonCanvasContent(attachment);
      if (content == null) return false;
      openCanvas(content, attachment.name);
      return true;
    }
    case FileExtension.PDF: {
      openLoadingPlaceholderIfFetching(attachment, openCanvas);
      const content = await resolvePdfCanvasContent(attachment);
      if (content == null) return false;
      openCanvas(content, attachment.name);
      return true;
    }
  }

  if (attachment.name != null && !isTextPreviewable(attachment.name)) {
    openCanvas(
      createUnsupportedCanvasContent(resolveDialUrl(attachment)),
      attachment.name,
    );
    return true;
  }

  const content = await resolveTextCanvasContent(attachment);
  if (content == null) return false;
  openCanvas(content, attachment.name);
  return true;
}

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
          openLoadingPlaceholderIfFetching(attachment, openCanvas);
          const content = await resolveImageCanvasContent(attachment);
          if (content == null) return false;
          openCanvas(content, attachment.name);
          return true;
        }
        case AttachmentType.File:
          return openFileCanvas(attachment, openCanvas);
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
