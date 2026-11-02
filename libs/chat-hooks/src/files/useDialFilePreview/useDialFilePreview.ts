import type { Attachment } from '@epam/ai-dial-chat-shared';
import type {
  DialFile,
  FileManagerGridRow,
} from '@epam/ai-dial-react-file-manager';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import { useCallback, useEffect, useRef } from 'react';
import { findDialFileByPath } from '../dial-file-manager-path.util';
import { dialFileToAttachment } from '../dial-file-to-attachment';

/** Host data and canvas operations for file preview. */
export interface UseDialFilePreviewOptions {
  /** Current folder tree. */
  items: DialFile[];
  /** Current search hits. Defaults to null. */
  searchResults?: DialFile[] | null;
  /** Default file bucket. */
  bucket: string;
  /** Supported filename extensions, chosen by the host. */
  previewExtensions: string[];
  /** Starts a request and returns its commit guard. */
  startRequest: () => () => boolean;
  /** Opens an attachment, consulting the guard before committing. */
  openAttachment: (
    attachment: Attachment,
    isCurrent: () => boolean,
  ) => Promise<boolean>;
  /** Opens an unsupported preview with an optional download URL. */
  openUnsupported: (name: string, id: string | undefined, url?: string) => void;
  /** Resolves a download URL for an unsupported attachment. */
  resolveUrl: (attachment: Attachment) => string | undefined;
}

/** Stable grid callbacks and the supplied extension policy. */
export interface UseDialFilePreviewResult {
  /** Previews a file from either current listing. */
  onPreview: (path?: string) => void;
  /** Previews the clicked row. */
  onFileClick: (row: FileManagerGridRow) => void;
  /** Host-provided extension policy. */
  previewExtensions: string[];
}

/** Previews current files while rejecting stale or unmounted completions. */
export const useDialFilePreview = ({
  items,
  searchResults = null,
  bucket,
  previewExtensions,
  startRequest,
  openAttachment,
  openUnsupported,
  resolveUrl,
}: UseDialFilePreviewOptions): UseDialFilePreviewResult => {
  const listings = useRef({ items, searchResults });
  const lifetime = useRef<object | undefined>(undefined);
  useEffect(() => {
    listings.current = { items, searchResults };
  }, [items, searchResults]);
  useEffect(() => {
    lifetime.current = {};
    return () => {
      lifetime.current = undefined;
    };
  }, []);
  const onPreview = useCallback(
    (path?: string) => {
      if (path == null) return;
      const file =
        findDialFileByPath(listings.current.items, path) ??
        findDialFileByPath(listings.current.searchResults ?? [], path);
      if (file?.nodeType !== DialFileNodeType.ITEM) return;
      const token = lifetime.current;
      const guard = startRequest();
      const isCurrent = () =>
        token !== undefined && lifetime.current === token && guard();
      const attachment = dialFileToAttachment(file, bucket);
      if (!attachment) {
        if (isCurrent()) openUnsupported(file.name, file.path);
        return;
      }
      const open = async () => {
        let opened = false;
        try {
          opened = await openAttachment(attachment, isCurrent);
        } catch {
          /* Failed conversions use the same unsupported state. */
        }
        if (!opened && isCurrent())
          openUnsupported(
            attachment.name,
            attachment.id,
            resolveUrl(attachment),
          );
      };
      void open();
    },
    [bucket, startRequest, openAttachment, openUnsupported, resolveUrl],
  );
  const onFileClick = useCallback(
    (row: FileManagerGridRow) => onPreview(row.path),
    [onPreview],
  );
  return { onPreview, onFileClick, previewExtensions };
};
