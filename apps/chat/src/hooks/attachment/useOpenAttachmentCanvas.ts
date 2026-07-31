import {
  AttachmentContentType,
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
import { useConversationPanel } from '../../context/ConversationPanelContext';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
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
      openCanvas(pdfContent, attachment.name, attachment.id);
      return true;
    }
  }

  const contentType = attachment.contentType.toLowerCase();

  if (!contentType && attachment.data != null) {
    const content = await resolveTextCanvasContent(attachment);
    if (content != null) {
      openCanvas(content, attachment.name, attachment.id);
      return true;
    }
  }

  switch (contentType) {
    case MIMEType.PDF: {
      const content = await resolvePdfCanvasContent(attachment);
      openCanvas(
        content ?? createUnsupportedCanvasContent(resolveDialUrl(attachment)),
        attachment.name,
        attachment.id,
      );
      return true;
    }
    case MIMEType.Markdown: {
      const content = await resolveMarkdownCanvasContent(attachment);
      openCanvas(
        content ?? createUnsupportedCanvasContent(resolveDialUrl(attachment)),
        attachment.name,
        attachment.id,
      );
      return true;
    }
    case MIMEType.JSON: {
      const content = await resolveJsonCanvasContent(attachment);
      openCanvas(
        content ?? createUnsupportedCanvasContent(resolveDialUrl(attachment)),
        attachment.name,
        attachment.id,
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
      openCanvas(content, attachment.name, attachment.id);
      return true;
    }
    case FileExtension.JSON: {
      const content = await resolveJsonCanvasContent(attachment);
      if (content == null) return false;
      openCanvas(content, attachment.name, attachment.id);
      return true;
    }
    case FileExtension.PDF: {
      const content = await resolvePdfCanvasContent(attachment);
      if (content == null) return false;
      openCanvas(content, attachment.name, attachment.id);
      return true;
    }
  }

  if (attachment.name != null && !isTextPreviewable(attachment.name)) {
    openCanvas(
      createUnsupportedCanvasContent(resolveDialUrl(attachment)),
      attachment.name,
      attachment.id,
    );
    return true;
  }

  const content = await resolveTextCanvasContent(attachment);
  if (content == null) return false;
  openCanvas(content, attachment.name, attachment.id);
  return true;
}

/**
 * Returns `openAttachmentCanvas`, an async function that opens the attachment
 * canvas for a given attachment. Returns `true` if the canvas was opened,
 * `false` if the attachment type is not previewable (caller may fall back to
 * downloading).
 */
export const useOpenAttachmentCanvas = () => {
  const { openCanvas, openCanvasLoading, closeCanvas } = useAttachmentCanvas();
  const { closePanel } = useConversationPanel();
  const { handleClose: closeSourcesPanel } = useSourcesSidebar();

  const openAttachmentCanvas = useCallback(
    async (attachment: DisplayAttachment): Promise<boolean> => {
      switch (attachment.type) {
        case AttachmentType.Image: {
          const content = resolveImageCanvasContent(attachment);
          if (content == null) return false;
          closePanel();
          closeSourcesPanel();
          openCanvas(content, attachment.name, attachment.id);
          return true;
        }
        case AttachmentType.Audio: {
          const url = attachment.playUrl ?? attachment.url;
          if (url == null) return false;
          openCanvas(
            {
              type: AttachmentContentType.Audio,
              url,
              mimeType: attachment.contentType || undefined,
            },
            attachment.name,
            attachment.id,
          );
          return true;
        }
        case AttachmentType.File: {
          closePanel();
          closeSourcesPanel();
          openCanvasLoading(attachment.name, attachment.id);
          const opened = await openFileCanvas(attachment, openCanvas);
          if (!opened) closeCanvas();
          return opened;
        }
        case AttachmentType.Pasted:
        case AttachmentType.Prompt: {
          closePanel();
          closeSourcesPanel();
          openCanvasLoading(attachment.name, attachment.id);
          const content = await resolveTextCanvasContent(attachment);
          if (content == null) {
            closeCanvas();
            return false;
          }
          openCanvas(content, attachment.name, attachment.id);
          return true;
        }
        default:
          return false;
      }
    },
    [openCanvas, openCanvasLoading, closeCanvas, closePanel, closeSourcesPanel],
  );

  return { openAttachmentCanvas };
};
