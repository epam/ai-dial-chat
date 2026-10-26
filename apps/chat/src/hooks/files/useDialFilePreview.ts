import {
  createUnsupportedCanvasContent,
  useAttachmentCanvas,
  useOpenAttachmentCanvas,
} from '@epam/ai-dial-attachment-canvas';
import {
  dialFileToAttachment,
  findDialFileByPath,
} from '@epam/ai-dial-chat-hooks';
import {
  DialFileNodeType,
  type DialFile,
  type FileManagerGridRow,
} from '@epam/ai-dial-react-file-manager';
import { useCallback, useEffect, useRef } from 'react';
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

/**
 * Opens a File Manager file in the attachment canvas. `onPreview` receives the
 * virtual path, so the file is looked up in the loaded tree, or among the
 * search results when the grid shows a search, and converted with the same
 * mapper the attach flow uses. When the canvas cannot open the file it shows
 * its own "unsupported" state, with a download button where the file has a
 * URL, so a chosen Preview never ends in silence. `onFileClick` opens the
 * clicked row the same way, whatever its extension, as a conversation does
 * for an attachment. A preview that a later one supersedes, or that finishes
 * after the page is gone, opens nothing.
 * @param items - folder tree the file manager is showing
 * @param bucket - the user's DIAL storage bucket
 * @param searchResults - files the grid currently lists as search hits
 */
export const useDialFilePreview = (
  items: DialFile[],
  bucket: string,
  searchResults: DialFile[] | null = null,
): {
  onPreview: (path?: string) => void;
  onFileClick: (row: FileManagerGridRow) => void;
  previewExtensions: string[];
} => {
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const { openCanvas } = useAttachmentCanvas();

  /*
   * The latest listing is read through refs so the callbacks keep their
   * identity when the listing refreshes; the file manager rebuilds its grid
   * options whenever a callback it holds changes.
   */
  const itemsRef = useRef(items);
  const searchResultsRef = useRef(searchResults);
  useEffect(() => {
    itemsRef.current = items;
    searchResultsRef.current = searchResults;
  }, [items, searchResults]);

  const startCanvasRequest = useLatestCanvasRequest();

  const onPreview = useCallback(
    (path?: string) => {
      if (path == null) return;
      const file =
        findDialFileByPath(itemsRef.current, path) ??
        findDialFileByPath(searchResultsRef.current ?? [], path);
      if (file?.nodeType !== DialFileNodeType.ITEM) return;

      const isCurrent = startCanvasRequest();

      const attachment = dialFileToAttachment(file, bucket);
      if (attachment == null) {
        openCanvas(createUnsupportedCanvasContent(), file.name, file.path);
        return;
      }

      void openAttachmentCanvas(attachment, undefined, isCurrent).then(
        (opened) => {
          if (!opened && isCurrent()) {
            openCanvas(
              createUnsupportedCanvasContent(resolveDialUrl(attachment)),
              attachment.name,
              attachment.id,
            );
          }
        },
      );
    },
    [bucket, openAttachmentCanvas, openCanvas, startCanvasRequest],
  );

  const onFileClick = useCallback(
    (row: FileManagerGridRow) => onPreview(row.path),
    [onPreview],
  );

  return {
    onPreview,
    onFileClick,
    previewExtensions: DIAL_FILE_PREVIEW_EXTENSIONS,
  };
};
