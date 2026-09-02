import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  EllipsisTooltip,
  Tooltip,
} from '@epam/ai-dial-ui-kit';
import { IconFolder } from '@tabler/icons-react';
import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import styles from '../ListView.module.scss';

/** Separator between segments in the full folder path. */
const PATH_SEPARATOR = ' / ';

/**
 * ag-grid cell renderer for the folder column: the deepest folder, with the
 * whole path in a tooltip.
 */
export const FolderCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data, context }) => {
  if (!data || data.folder.length === 0) return null;

  const path = data.folder.join(PATH_SEPARATOR);
  const leafName = data.folder[data.folder.length - 1];
  const hasParentFolders = data.folder.length > 1;
  const pathClassName =
    context?.typography?.folderClassName ?? 'dial-small-text';
  const leafClassName =
    context?.typography?.folderLastSegmentClassName ?? 'dial-small-semi-text';

  /*
   * A breadcrumb of the whole path has no room in this column: every segment
   * shrinks to an equal share and the path reads "Organization > pub… > p..".
   * The deepest folder is the one that identifies the row, so it gets the
   * width, and the path it sits in stays one hover (and one screen-reader
   * pass) away.
   */
  return (
    <div className="flex h-full w-full min-w-0 items-center gap-1.5">
      <IconFolder
        size={DIAL_ICON_SIZE.SM}
        stroke={DIAL_KIT_ICON_STROKE}
        className={mergeClasses('shrink-0', styles.folderIcon)}
        aria-hidden
      />
      <Tooltip
        tooltip={<span className={pathClassName}>{path}</span>}
        hideTooltip={!hasParentFolders}
        triggerClassName="min-w-0 flex-1"
      >
        <EllipsisTooltip
          text={leafName}
          className={leafClassName}
          /* The path tooltip already carries the full text. */
          hideTooltip={hasParentFolders}
        />
      </Tooltip>
      {hasParentFolders && <span className="sr-only">{path}</span>}
    </div>
  );
};
