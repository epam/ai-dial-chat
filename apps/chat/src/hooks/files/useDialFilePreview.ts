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
} from '@epam/ai-dial-react-file-manager';
import { useCallback } from 'react';
import { resolveDialUrl } from '../../utils/dial-file';
import { useAttachmentCanvasResolvers } from '../attachment/useAttachmentCanvasResolvers';

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
 * virtual path, so the file is looked up in the loaded tree and converted with
 * the same mapper the attach flow uses. When the canvas cannot open the file
 * it shows its own "unsupported" state, with a download button where the file
 * has a URL, so a chosen Preview never ends in silence.
 * @param items - folder tree the file manager is showing
 * @param bucket - the user's DIAL storage bucket
 */
export const useDialFilePreview = (
  items: DialFile[],
  bucket: string,
): {
  onPreview: (path?: string) => void;
  previewExtensions: string[];
} => {
  const { resolvers, options } = useAttachmentCanvasResolvers();
  const { openAttachmentCanvas } = useOpenAttachmentCanvas(resolvers, options);
  const { openCanvas } = useAttachmentCanvas();

  const onPreview = useCallback(
    (path?: string) => {
      if (path == null) return;
      const file = findDialFileByPath(items, path);
      if (file?.nodeType !== DialFileNodeType.ITEM) return;

      const attachment = dialFileToAttachment(file, bucket);
      if (attachment == null) {
        openCanvas(createUnsupportedCanvasContent(), file.name, file.path);
        return;
      }

      void openAttachmentCanvas(attachment).then((opened) => {
        if (!opened) {
          openCanvas(
            createUnsupportedCanvasContent(resolveDialUrl(attachment)),
            attachment.name,
            attachment.id,
          );
        }
      });
    },
    [items, bucket, openAttachmentCanvas, openCanvas],
  );

  return { onPreview, previewExtensions: DIAL_FILE_PREVIEW_EXTENSIONS };
};
