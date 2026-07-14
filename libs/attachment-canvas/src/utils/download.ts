import { MIMEType } from '@epam/ai-dial-chat-shared';
import type { AttachmentCanvasContent } from '../models/attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
} from '../types/attachment-canvas';

/** Returns true if the given canvas content can be downloaded. */
export const isDownloadable = (content: AttachmentCanvasContent): boolean => {
  switch (content.type) {
    case AttachmentContentType.PlainText:
    case AttachmentContentType.Markdown:
    case AttachmentContentType.Json:
    case AttachmentContentType.Image:
    case AttachmentContentType.Pdf:
      return true;
    case AttachmentContentType.Unsupported:
      return content.url != null;
    case AttachmentContentType.Error:
      return (
        content.errorType !== AttachmentErrorType.Forbidden &&
        content.url != null
      );
  }
};

/** Fetches a URL and returns its response body as a `Blob`. */
export const fetchBlobFromUrl = async (url: string): Promise<Blob> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.blob();
};

/** Triggers a browser download for the given canvas content. */
export const downloadAttachmentContent = (
  content: AttachmentCanvasContent,
  fileName?: string,
): void => {
  let href: string;
  let revokeAfter = false;
  switch (content.type) {
    case AttachmentContentType.PlainText:
      if (content.text === '') return;
      href = URL.createObjectURL(
        new Blob([content.text], { type: MIMEType.Plain }),
      );
      revokeAfter = true;
      break;
    case AttachmentContentType.Markdown:
      if (content.text === '') return;
      href = URL.createObjectURL(
        new Blob([content.text], { type: MIMEType.Markdown }),
      );
      revokeAfter = true;
      break;
    case AttachmentContentType.Json:
      href = URL.createObjectURL(
        new Blob([JSON.stringify(content.value, null, 2)], {
          type: MIMEType.JSON,
        }),
      );
      revokeAfter = true;
      break;
    case AttachmentContentType.Image:
    case AttachmentContentType.Pdf:
      href = content.url;
      break;
    case AttachmentContentType.Unsupported:
      if (content.url == null) return;
      href = content.url;
      break;
    case AttachmentContentType.Error:
      if (!isDownloadable(content)) return;
      href = content.url!;
      break;
  }
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName ?? 'attachment';
  anchor.click();
  if (revokeAfter) URL.revokeObjectURL(href);
};
