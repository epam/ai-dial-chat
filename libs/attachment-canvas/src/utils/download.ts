import {
  MIMEType,
  ensureDownloadFilename,
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
    case AttachmentContentType.Ooxml:
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

/*
 * Returns the URL and MIME type hint that best describe `content` for the
 * purposes of deriving a file extension when the display name lacks one.
 */
const getContentUrlAndMimeType = (
  content: AttachmentCanvasContent,
): { url: string | undefined; mimeType: string | undefined } => {
  switch (content.type) {
    case AttachmentContentType.Image:
      return { url: content.url, mimeType: undefined };
    case AttachmentContentType.Audio:
      return { url: content.url, mimeType: content.mimeType };
    case AttachmentContentType.Pdf:
      return { url: content.url, mimeType: MIMEType.PDF };
    case AttachmentContentType.Ooxml:
      return { url: content.url, mimeType: undefined };
    case AttachmentContentType.Html:
      return { url: content.url, mimeType: MIMEType.HTML };
    case AttachmentContentType.Unsupported:
    case AttachmentContentType.Error:
      return { url: content.url, mimeType: undefined };
    case AttachmentContentType.PlainText:
    case AttachmentContentType.Code:
      return { url: undefined, mimeType: MIMEType.Plain };
    case AttachmentContentType.Markdown:
      return { url: undefined, mimeType: MIMEType.Markdown };
    case AttachmentContentType.Json:
      return { url: undefined, mimeType: MIMEType.JSON };
    default:
      return { url: undefined, mimeType: undefined };
  }
};

/** Triggers a browser download for the given canvas content. */
export const downloadAttachmentContent = (
  content: AttachmentCanvasContent,
  fileName?: string,
): void => {
  const { url: contentUrl, mimeType: contentMimeType } =
    getContentUrlAndMimeType(content);
  const name = ensureDownloadFilename(
    fileName ?? 'attachment',
    contentUrl,
    contentMimeType,
  );
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
    case AttachmentContentType.Ooxml:
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
