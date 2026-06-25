import type {
  ImageCanvasContent,
  JsonCanvasContent,
  MarkdownCanvasContent,
  PlainTextCanvasContent,
} from '@epam/ai-dial-attachment-canvas';
import { AttachmentContentType } from '@epam/ai-dial-attachment-canvas';
import type { Attachment, DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { resolveDialUrl } from './dial-file';

/** Resolves an image canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveImageCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<ImageCanvasContent | null> => {
  const url = resolveDialUrl(attachment);
  if (url != null) return { type: AttachmentContentType.Image, url };
  if ('file' in attachment) {
    const a = attachment as Attachment;
    const fileUrl = a.previewUrl ?? URL.createObjectURL(a.file);
    return { type: AttachmentContentType.Image, url: fileUrl };
  }
  return null;
};

/** Resolves a plain-text canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveTextCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<PlainTextCanvasContent | null> => {
  const downloadUrl = resolveDialUrl(attachment);
  if (downloadUrl != null) {
    const response = await fetch(downloadUrl);
    if (!response.ok) return null;
    const text = await response.text();
    return { type: AttachmentContentType.PlainText, text };
  }
  if ('file' in attachment && (attachment as Attachment).file.size > 0) {
    const text = await (attachment as Attachment).file.text();
    return { type: AttachmentContentType.PlainText, text };
  }
  return null;
};

/** Resolves a Markdown canvas content payload from a DisplayAttachment, or `null` if unavailable. */
export const resolveMarkdownCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<MarkdownCanvasContent | null> => {
  if (attachment.data != null) {
    return { type: AttachmentContentType.Markdown, text: attachment.data };
  }
  const downloadUrl = resolveDialUrl(attachment);
  if (downloadUrl != null) {
    const response = await fetch(downloadUrl);
    if (!response.ok) return null;
    const text = await response.text();
    return { type: AttachmentContentType.Markdown, text };
  }
  if ('file' in attachment && (attachment as Attachment).file.size > 0) {
    const text = await (attachment as Attachment).file.text();
    return { type: AttachmentContentType.Markdown, text };
  }
  return null;
};

/**
 * Resolves a JSON canvas content payload from a DisplayAttachment, or `null` if unavailable.
 * Falls back to `PlainTextCanvasContent` when the fetched text is not valid JSON.
 */
export const resolveJsonCanvasContent = async (
  attachment: DisplayAttachment,
): Promise<JsonCanvasContent | PlainTextCanvasContent | null> => {
  let text: string;

  if (attachment.data != null) {
    text = attachment.data;
  } else {
    const downloadUrl = resolveDialUrl(attachment);
    if (downloadUrl != null) {
      const response = await fetch(downloadUrl);
      if (!response.ok) return null;
      text = await response.text();
    } else if (
      'file' in attachment &&
      (attachment as Attachment).file.size > 0
    ) {
      text = await (attachment as Attachment).file.text();
    } else {
      return null;
    }
  }

  try {
    const value = JSON.parse(text);
    return { type: AttachmentContentType.Json, value };
  } catch {
    return { type: AttachmentContentType.PlainText, text };
  }
};
