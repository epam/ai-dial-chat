import {
  MIMEType,
  triggerAnchorDownload,
  triggerBlobDownload,
} from '@epam/ai-dial-chat-shared';
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
    case AttachmentContentType.Audio:
    case AttachmentContentType.Pdf:
    case AttachmentContentType.Code:
      return true;
    case AttachmentContentType.Html:
      return content.url != null;
    case AttachmentContentType.Visualizer:
    case AttachmentContentType.McpApp:
      return false;
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
  const name = fileName ?? 'attachment';
  switch (content.type) {
    case AttachmentContentType.PlainText:
      if (content.text === '') return;
      triggerBlobDownload(
        new Blob([content.text], { type: MIMEType.Plain }),
        name,
      );
      return;
    case AttachmentContentType.Markdown:
      if (content.text === '') return;
      triggerBlobDownload(
        new Blob([content.text], { type: MIMEType.Markdown }),
        name,
      );
      return;
    case AttachmentContentType.Json:
      triggerBlobDownload(
        new Blob([JSON.stringify(content.value, null, 2)], {
          type: MIMEType.JSON,
        }),
        name,
      );
      return;
    case AttachmentContentType.Image:
    case AttachmentContentType.Audio:
    case AttachmentContentType.Pdf:
      triggerAnchorDownload(content.url, name);
      return;
    case AttachmentContentType.Code:
      if (content.text === '') return;
      triggerBlobDownload(
        new Blob([content.text], { type: MIMEType.Plain }),
        name,
      );
      return;
    case AttachmentContentType.Html:
      if (content.url == null) return;
      triggerAnchorDownload(content.url, name);
      return;
    case AttachmentContentType.Visualizer:
    case AttachmentContentType.McpApp:
      return;
    case AttachmentContentType.Unsupported:
      if (content.url == null) return;
      triggerAnchorDownload(content.url, name);
      return;
    case AttachmentContentType.Error:
      if (!isDownloadable(content) || content.url == null) return;
      triggerAnchorDownload(content.url, name);
      return;
  }
};
