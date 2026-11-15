import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogContentFilePreview } from '../../../models/item-details-data';
import type { DetailsPanelProps } from '../../../models/item-details-props';
import { CatalogContentPreviewType } from '../../../types/catalog-content-type';
import {
  collectAllFolderIds,
  findContentNodeName,
} from '../../../utils/catalog-content-tree';

/** Parameters for {@link useDetailsContentFile}. */
export type UseDetailsContentFileParams = Pick<
  DetailsPanelProps,
  | 'item'
  | 'onLoadContentFile'
  | 'onLoadContentFilePreview'
  | 'renderContentFilePreview'
  | 'texts'
>;

/** Content-tab file picker state for the details panel. */
export const useDetailsContentFile = ({
  item,
  onLoadContentFile,
  onLoadContentFilePreview,
  renderContentFilePreview,
  texts,
}: UseDetailsContentFileParams) => {
  const promptContent = item.details?.promptContent;
  const baseFileId = promptContent?.selectedFileId;
  /*
   * A picked file overlays the body the details fetch already supplied.
   * `null` means "showing the base content", so reselecting the base file
   * costs no request.
   */
  const [pickedFile, setPickedFile] = useState<{
    id: string;
    preview: CatalogContentFilePreview | null;
  } | null>(null);
  const [isContentFileLoading, setIsContentFileLoading] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);

  /*
   * The blob: URL (if any) currently displayed as an image preview. Tracked
   * outside React state so it can be revoked exactly once, right before it
   * stops being displayed — never for a host-supplied non-blob URL.
   */
  const activeImageUrlRef = useRef<string | null>(null);
  /*
   * Guards against an out-of-order resolution: a superseded pick (or an item
   * switch) bumps this, and a resolution whose captured generation no longer
   * matches the latest one is discarded on arrival.
   */
  const requestGenerationRef = useRef(0);

  const setPickedFilePreview = useCallback(
    (
      next: { id: string; preview: CatalogContentFilePreview | null } | null,
    ) => {
      const previousUrl = activeImageUrlRef.current;
      const nextUrl =
        next?.preview?.type === CatalogContentPreviewType.Image
          ? next.preview.url
          : null;
      if (
        previousUrl != null &&
        previousUrl !== nextUrl &&
        previousUrl.startsWith('blob:')
      ) {
        URL.revokeObjectURL(previousUrl);
      }
      activeImageUrlRef.current = nextUrl;
      setPickedFile(next);
    },
    [],
  );

  /*
   * A new item, or a re-fetched body, invalidates whatever file was picked
   * and resets the selector back to every folder expanded and closed.
   */
  useEffect(() => {
    requestGenerationRef.current += 1;
    setPickedFilePreview(null);
    setIsContentFileLoading(false);
    setExpandedFolderIds(collectAllFolderIds(promptContent?.files ?? []));
    setIsFileSelectorOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, baseFileId]);

  /* Revoke whatever blob: URL is still displayed when the panel unmounts. */
  useEffect(() => {
    return () => {
      const url = activeImageUrlRef.current;
      if (url != null && url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, []);

  const handleToggleFolder = useCallback((folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleSelectContentFile = useCallback(
    async (fileId: string) => {
      if (fileId === baseFileId) {
        requestGenerationRef.current += 1;
        setPickedFilePreview(null);
        setIsContentFileLoading(false);
        return;
      }
      if (
        renderContentFilePreview == null &&
        onLoadContentFile == null &&
        onLoadContentFilePreview == null
      ) {
        return;
      }

      if (renderContentFilePreview != null) {
        requestGenerationRef.current += 1;
        setPickedFilePreview({ id: fileId, preview: null });
        setIsContentFileLoading(false);
        return;
      }

      const generation = ++requestGenerationRef.current;
      setPickedFilePreview({ id: fileId, preview: null });
      setIsContentFileLoading(true);
      try {
        const preview: CatalogContentFilePreview | undefined =
          onLoadContentFilePreview != null
            ? await onLoadContentFilePreview(fileId)
            : await onLoadContentFile?.(fileId).then((text) =>
                text != null
                  ? ({
                      type: CatalogContentPreviewType.Markdown,
                      text,
                    } satisfies CatalogContentFilePreview)
                  : undefined,
              );
        if (requestGenerationRef.current !== generation) {
          /*
           * A discarded resolution's own image preview was never tracked by
           * `activeImageUrlRef` (it only learns about a URL through
           * `setPickedFilePreview`), so its `blob:` URL must be revoked here
           * or it leaks.
           */
          if (
            preview?.type === CatalogContentPreviewType.Image &&
            preview.url.startsWith('blob:')
          ) {
            URL.revokeObjectURL(preview.url);
          }
          return;
        }
        setPickedFilePreview({ id: fileId, preview: preview ?? null });
      } catch {
        if (requestGenerationRef.current !== generation) return;
        setPickedFilePreview({ id: fileId, preview: null });
      } finally {
        if (requestGenerationRef.current === generation) {
          setIsContentFileLoading(false);
        }
      }
    },
    [
      baseFileId,
      onLoadContentFile,
      onLoadContentFilePreview,
      renderContentFilePreview,
      setPickedFilePreview,
    ],
  );

  const selectedFileId = pickedFile?.id ?? baseFileId;
  const resolveContentFilePreview = (): CatalogContentFilePreview | null => {
    if (pickedFile == null) return null;
    if (pickedFile.preview != null) return pickedFile.preview;
    return {
      type: CatalogContentPreviewType.Text,
      text: texts?.contentFileErrorLabel ?? 'Failed to load this file.',
    };
  };
  const renderedContentFilePreview: ReactNode =
    pickedFile != null && renderContentFilePreview != null
      ? renderContentFilePreview(
          pickedFile.id,
          findContentNodeName(promptContent?.files ?? [], pickedFile.id) ?? '',
        )
      : undefined;

  return {
    promptContent,
    selectedFileId,
    isContentFileLoading,
    expandedFolderIds,
    isFileSelectorOpen,
    setIsFileSelectorOpen,
    handleToggleFolder,
    handleSelectContentFile,
    resolveContentFilePreview,
    renderedContentFilePreview,
  };
};
