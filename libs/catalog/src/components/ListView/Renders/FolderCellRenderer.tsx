import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { IconFolder } from '@tabler/icons-react';
import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import styles from '../ListView.module.scss';

export const FolderCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data, context }) => {
  const folderClassName =
    context?.typography?.folderClassName ?? 'dial-small-text';
  const folderLastSegmentClassName =
    context?.typography?.folderLastSegmentClassName ?? 'dial-small-semi-text';

  if (!data || data.folder.length === 0) return null;

  const allButLast = data.folder.slice(0, -1);
  const last = data.folder[data.folder.length - 1];

  return (
    <div
      className={mergeClasses(
        'flex h-full items-center gap-1.5',
        styles.secondaryText,
      )}
    >
      <IconFolder size={14} className="shrink-0" />
      <span className="min-w-0 truncate">
        {allButLast.length > 0 && (
          <span className={folderClassName}>
            {allButLast.join(' / ')}
            {' / '}
          </span>
        )}
        <span className={folderLastSegmentClassName}>{last}</span>
      </span>
    </div>
  );
};
