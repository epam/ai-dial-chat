import type { AttachmentCanvasContent } from '../models/attachment-canvas';
import { AttachmentContentType } from '../types/attachment-canvas';

/** Triggers a browser download for the given canvas content. */
export const downloadAttachmentContent = (
  content: AttachmentCanvasContent,
  fileName?: string,
): void => {
  let href: string;
  let revokeAfter = false;
  if (content.type === AttachmentContentType.PlainText) {
    if (content.text === '') return;
    href = URL.createObjectURL(
      new Blob([content.text], { type: 'text/plain' }),
    );
    revokeAfter = true;
  } else {
    href = content.url;
  }
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName ?? 'attachment';
  anchor.click();
  if (revokeAfter) URL.revokeObjectURL(href);
};
