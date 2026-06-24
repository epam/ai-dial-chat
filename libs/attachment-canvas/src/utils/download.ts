import { MIMEType } from '@epam/ai-dial-chat-shared';
import type { AttachmentCanvasContent } from '../models/attachment-canvas';
import { AttachmentContentType } from '../types/attachment-canvas';

const supportedDownloadTypes = [
  AttachmentContentType.PlainText,
  AttachmentContentType.Markdown,
  AttachmentContentType.Json,
  AttachmentContentType.Image,
];

/** Returns true if the given canvas content can be downloaded. */
export const isDownloadable = (contentType: AttachmentContentType): boolean =>
  supportedDownloadTypes.includes(contentType);

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
      href = content.url;
      break;
    case AttachmentContentType.Unsupported:
      return;
  }
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName ?? 'attachment';
  anchor.click();
  if (revokeAfter) URL.revokeObjectURL(href);
};
