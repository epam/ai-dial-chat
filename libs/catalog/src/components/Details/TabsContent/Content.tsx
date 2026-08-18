import {
  MarkdownCodeBlock,
  MarkdownWithPlaceholders,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  Dropdown,
  ElementSize,
  InlineSelectTrigger,
} from '@epam/ai-dial-ui-kit';
import { FC, type ReactNode } from 'react';
import type {
  CatalogContentFilePreview,
  CatalogContentTreeNode,
} from '../../../models/item-details-data';
import type { ItemDetailsStyles } from '../../../models/item-details-props';
import { CatalogContentPreviewType } from '../../../types/catalog-content-preview-type';
import {
  countFileNodes,
  findContentNodeName,
} from '../../../utils/catalog-content-tree';
import styles from './Content.module.scss';
import { ContentFileTree } from './ContentFileTree/ContentFileTree';

const noop = () => undefined;

/** Props for ContentTab. */
export interface ContentTabProps {
  /** The item's full text body, rendered read-only as markdown. */
  content: string;
  /** Short summary shown above the body. Omitted when empty. */
  description?: string;
  /** Folder/file tree the tab can switch between. A selector renders whenever this holds two or more file nodes, at any depth. */
  files?: CatalogContentTreeNode[];
  /** Id of the file currently displayed. */
  selectedFileId?: string;
  /** Called with a file's `id` when a different one is picked. */
  onSelectFile?: (fileId: string) => void;
  /** Whether the picked file's content is still loading. */
  isFileLoading?: boolean;
  /** Ids of folders currently expanded in the selector. Defaults to an empty set. */
  expandedFolderIds?: ReadonlySet<string>;
  /** Called with a folder's id when its disclosure control is toggled. */
  onToggleFolder?: (folderId: string) => void;
  /** Whether the file selector overlay is open. Defaults to `false`. */
  isFileSelectorOpen?: boolean;
  /** Called when the file selector's open state should change. */
  onFileSelectorOpenChange?: (open: boolean) => void;
  /** Accessible label for the file selector. Defaults to `'Select file'`. */
  fileSelectorAriaLabel?: string;
  /** Returns the file-count text shown beside the selector. Defaults to ``(count) => `${count} files` ``. */
  fileCountLabel?: (count: number) => string;
  /** Status text announced while a picked file loads. Defaults to `'Loading file'`. */
  fileLoadingLabel?: string;
  /** Body text shown when a picked file's preview type is `unsupported`. Defaults to `'Preview is not supported for this file'`. */
  fileUnsupportedLabel?: string;
  /**
   * The currently picked file's resolved preview. Absent (or `null`) renders
   * `content` as Markdown — the base file's state. Ignored while
   * `isFileLoading` is `true`, so a stale preview never appears under a
   * newly-selected file's name while its own load is still pending.
   */
  filePreview?: CatalogContentFilePreview | null;
  /** Host-rendered picked-file preview. Takes precedence over `filePreview`. */
  filePreviewContent?: ReactNode;
  /** Color and typography overrides for the body text, headings, and placeholder highlights. */
  detailsStyles?: ItemDetailsStyles;
}

/**
 * Renders a catalog item's summary and its long-form body as read-only
 * markdown, with `{{placeholder}}` tokens highlighted. An item carrying more
 * than one file, at any depth, gets a hierarchical selector above the body to
 * switch between them.
 */
export const ContentTab: FC<ContentTabProps> = ({
  content,
  description,
  files,
  selectedFileId,
  onSelectFile,
  isFileLoading = false,
  expandedFolderIds = new Set<string>(),
  onToggleFolder = noop,
  isFileSelectorOpen = false,
  onFileSelectorOpenChange = noop,
  fileSelectorAriaLabel = 'Select file',
  fileCountLabel = (count) => `${count} files`,
  fileLoadingLabel = 'Loading file',
  fileUnsupportedLabel = 'Preview is not supported for this file',
  filePreview,
  filePreviewContent,
  detailsStyles,
}) => {
  const bodyClassName =
    detailsStyles?.typography?.contentClassName ?? 'dial-small-text';
  const headingClassName =
    detailsStyles?.typography?.contentHeadingClassName ??
    'dial-small-semi-text';
  const fileCountClassName =
    detailsStyles?.typography?.contentFileCountClassName ?? 'dial-tiny-text';

  const hasDescription = description != null && description !== '';

  const fileNodes = files ?? [];
  /* A single file is the body itself — a selector with one option is noise. */
  const hasFileChoice = countFileNodes(fileNodes) > 1;
  const selectedFileName = findContentNodeName(fileNodes, selectedFileId) ?? '';

  const handleSelectFile = (fileId: string) => {
    onSelectFile?.(fileId);
    onFileSelectorOpenChange(false);
  };

  /*
   * While loading, the body is forced blank regardless of a stale preview or
   * the base content — otherwise the previous file's text could flash under
   * the newly-selected file's name until its own load settles.
   */
  const previewToRender: CatalogContentFilePreview = isFileLoading
    ? { type: CatalogContentPreviewType.Text, text: '' }
    : (filePreview ?? {
        type: CatalogContentPreviewType.Markdown,
        text: content,
      });

  const renderPreview = () => {
    if (filePreviewContent != null) return filePreviewContent;

    switch (previewToRender.type) {
      case CatalogContentPreviewType.Markdown:
        return (
          <MarkdownWithPlaceholders
            content={previewToRender.text}
            headingClassName={headingClassName}
          />
        );
      case CatalogContentPreviewType.Text:
        return (
          <MarkdownCodeBlock
            language={previewToRender.language ?? ''}
            value={previewToRender.text}
            hideDownload
          />
        );
      case CatalogContentPreviewType.Image:
        return (
          <img
            src={previewToRender.url}
            alt={selectedFileName}
            className="max-w-full"
          />
        );
      case CatalogContentPreviewType.Unsupported:
        return <p className="m-0">{fileUnsupportedLabel}</p>;
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 pb-6">
      {hasFileChoice && (
        <div className="flex shrink-0 items-center gap-3">
          <Dropdown
            open={isFileSelectorOpen}
            onOpenChange={onFileSelectorOpenChange}
            trigger={[]}
            matchReferenceWidth={false}
            placement="bottom-start"
            renderOverlay={() => (
              <ContentFileTree
                nodes={fileNodes}
                selectedFileId={selectedFileId}
                expandedFolderIds={expandedFolderIds}
                onToggleFolder={onToggleFolder}
                onSelectFile={handleSelectFile}
                onClose={() => onFileSelectorOpenChange(false)}
                ariaLabel={fileSelectorAriaLabel}
                rowNameClassName={bodyClassName}
              />
            )}
          >
            <InlineSelectTrigger
              label={selectedFileName}
              size={ElementSize.Small}
              isOpen={isFileSelectorOpen}
              onClick={() => onFileSelectorOpenChange(!isFileSelectorOpen)}
            />
          </Dropdown>
          <span
            className={mergeClasses(
              'shrink-0',
              fileCountClassName,
              styles.fileCount,
            )}
          >
            {fileCountLabel(countFileNodes(fileNodes))}
          </span>
        </div>
      )}

      {hasDescription && (
        <>
          <p className={mergeClasses('m-0', bodyClassName)}>{description}</p>
          <div className={mergeClasses('shrink-0', styles.divider)} />
        </>
      )}

      <div
        className={mergeClasses(
          'min-h-0 flex-1 text-start',
          filePreviewContent != null
            ? 'overflow-hidden'
            : 'overflow-auto break-words',
          filePreviewContent == null && styles.body,
          filePreviewContent == null && bodyClassName,
        )}
      >
        {isFileLoading && (
          <span role="status" className="sr-only">
            {fileLoadingLabel}
          </span>
        )}
        {renderPreview()}
      </div>
    </div>
  );
};
