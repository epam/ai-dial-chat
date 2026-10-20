import { useOpenAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import { dialFileToAttachment } from '@epam/ai-dial-chat-hooks';
import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { useCallback } from 'react';
import { useAttachmentCanvasResolvers } from '../attachment/useAttachmentCanvasResolvers';

/* SPIKE: hard-coded; the real list should come from the canvas's own type detection. */
export const DIAL_FILE_PREVIEW_EXTENSIONS = [
  '.txt',
  '.md',
  '.json',
  '.csv',
  '.html',
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
];

const findFileByPath = (
  items: DialFile[] | undefined,
  path: string,
): DialFile | undefined => {
  for (const item of items ?? []) {
    if (item.path === path) return item;
    if (item.nodeType === DialFileNodeType.FOLDER) {
      const found = findFileByPath(item.items, path);
      if (found) return found;
    }
  }
  return undefined;
};

/**
 * Opens a File Manager file in the attachment canvas. `onPreview` receives the
 * virtual path, so the file is looked up in the loaded tree and converted with
 * the same mapper the attach flow uses.
 */
export const useDialFilePreview = (items: DialFile[], bucket: string) => {
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);

  const onPreview = useCallback(
    (path?: string) => {
      if (path == null) return;
      const file = findFileByPath(items, path);
      const attachment = file && dialFileToAttachment(file, bucket);
      if (attachment) void openAttachmentCanvas(attachment);
    },
    [items, bucket, openAttachmentCanvas],
  );

  return { onPreview, previewExtensions: DIAL_FILE_PREVIEW_EXTENSIONS };
};
