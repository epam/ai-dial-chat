import {
  MarkdownWithPlaceholders,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { ElementSize, InlineSelect } from '@epam/ai-dial-ui-kit';
import { FC, useMemo } from 'react';
import type { CatalogContentFile } from '../../../models/item-details-data';
import type { ItemDetailsStyles } from '../../../models/item-details-props';
import styles from './Content.module.scss';

/** Props for ContentTab. */
export interface ContentTabProps {
  /** The item's full text body, rendered read-only as markdown. */
  content: string;
  /** Short summary shown above the body. Omitted when empty. */
  description?: string;
  /** Files the tab can switch between. A picker renders whenever this holds two or more entries. */
  files?: CatalogContentFile[];
  /** Id of the file currently displayed. */
  selectedFileId?: string;
  /** Called with a file's `id` when a different one is picked. */
  onSelectFile?: (fileId: string) => void;
  /** Whether the picked file's content is still loading. */
  isFileLoading?: boolean;
  /** Accessible label for the file picker. Defaults to `'Select file'`. */
  fileSelectorAriaLabel?: string;
  /** Returns the file-count text shown beside the picker. Defaults to ``(count) => `${count} files` ``. */
  fileCountLabel?: (count: number) => string;
  /** Status text announced while a picked file loads. Defaults to `'Loading file'`. */
  fileLoadingLabel?: string;
  /** Color and typography overrides for the body text, headings, and placeholder highlights. */
  detailsStyles?: ItemDetailsStyles;
}

/**
 * Renders a catalog item's summary and its long-form body as read-only
 * markdown, with `{{placeholder}}` tokens highlighted. An item carrying more
 * than one file gets a picker above the body to switch between them.
 */
export const ContentTab: FC<ContentTabProps> = ({
  content,
  description,
  files,
  selectedFileId,
  onSelectFile,
  isFileLoading = false,
  fileSelectorAriaLabel = 'Select file',
  fileCountLabel = (count) => `${count} files`,
  fileLoadingLabel = 'Loading file',
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

  const fileItems = useMemo(
    () => (files ?? []).map((file) => ({ key: file.id, label: file.name })),
    [files],
  );
  /* A single file is the body itself — a picker with one option is noise. */
  const hasFileChoice = fileItems.length > 1;

  return (
    <div className="flex h-full flex-col gap-4 pb-6">
      {hasFileChoice && (
        <div className="flex shrink-0 items-center gap-3">
          <InlineSelect
            items={fileItems}
            selectedKey={selectedFileId}
            onSelect={(item) => onSelectFile?.(item.key)}
            matchReferenceWidth={false}
            placement="bottom-start"
            size={ElementSize.Small}
            ariaLabel={fileSelectorAriaLabel}
          />
          <span
            className={mergeClasses(
              'shrink-0',
              fileCountClassName,
              styles.fileCount,
            )}
          >
            {fileCountLabel(fileItems.length)}
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
          'min-h-0 flex-1 overflow-auto break-words text-start',
          styles.body,
          bodyClassName,
        )}
      >
        {isFileLoading && (
          <span role="status" className="sr-only">
            {fileLoadingLabel}
          </span>
        )}
        <MarkdownWithPlaceholders
          content={content}
          headingClassName={headingClassName}
        />
      </div>
    </div>
  );
};
