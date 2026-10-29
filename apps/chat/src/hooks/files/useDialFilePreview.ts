import {
  createUnsupportedCanvasContent,
  useAttachmentCanvas,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import { useDialFilePreview as usePreview } from '@epam/ai-dial-chat-hooks/file-manager-canvas';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { useCallback } from 'react';
import { resolveDialUrl } from '../../utils/dial-file';
import { useAttachmentCanvasResolvers } from '../attachment/useAttachmentCanvasResolvers';
import { useLatestCanvasRequest } from '../attachment/useLatestCanvasRequest';
const PREVIEWABLE_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.tsv',
  '.xml',
  '.yaml',
  '.yml',
  '.log',
  '.html',
  '.htm',
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

const capitalize = (extension: string): string =>
  `.${extension.charAt(1).toUpperCase()}${extension.slice(2)}`;

/**
 * Extensions the file manager offers Preview for: the formats the attachment
 * canvas renders, anything else would only reach its "unsupported" state. The
 * file manager compares a file's extension with this list exactly as written,
 * so each format is listed in lower case, UPPER case and Capitalized case
 * (`.jpg`, `.JPG`, `.Jpg`), the three spellings file names usually carry.
 */
export const DIAL_FILE_PREVIEW_EXTENSIONS = [
  ...new Set(
    PREVIEWABLE_EXTENSIONS.flatMap((extension) => [
      extension,
      extension.toUpperCase(),
      capitalize(extension),
    ]),
  ),
];

/** Connects file previews to the host canvas and download URL resolver. */
export const useDialFilePreview = (
  items: DialFile[],
  bucket: string,
  searchResults: DialFile[] | null = null,
) => {
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const { openCanvas } = useAttachmentCanvas();
  const startRequest = useLatestCanvasRequest();
  const openAttachment = useCallback(
    (
      attachment: Parameters<typeof openAttachmentCanvas>[0],
      isCurrent: () => boolean,
    ) => openAttachmentCanvas(attachment, undefined, isCurrent),
    [openAttachmentCanvas],
  );
  const openUnsupported = useCallback(
    (name: string, id: string | undefined, url?: string) =>
      openCanvas(createUnsupportedCanvasContent(url), name, id),
    [openCanvas],
  );
  return usePreview({
    items,
    bucket,
    searchResults,
    previewExtensions: DIAL_FILE_PREVIEW_EXTENSIONS,
    startRequest,
    openAttachment,
    openUnsupported,
    resolveUrl: resolveDialUrl,
  });
};
