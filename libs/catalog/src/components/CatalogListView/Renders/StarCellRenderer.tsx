import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import type { ICellRendererParams } from 'ag-grid-community';
import { FC, useState } from 'react';
import type { CatalogItem } from '../../../models/catalog';
import { GridContext } from '../../../models/GridContext';
import styles from '../CatalogListView.module.scss';

export const StarCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data, context }) => {
  const [isStarred, setIsStarred] = useState(data?.isStarred ?? false);

  if (!data) return null;

  const handleToggle = () => {
    const next = !isStarred;
    setIsStarred(next);
    context?.onToggleFavorite?.(data.id, next);
  };

  return (
    <div className="flex h-full items-center justify-center pe-4">
      <DialGhostIconButton
        icon={
          isStarred ? (
            <IconStarFilled
              size={DIAL_ICON_SIZE.SM}
              className={styles.starFilledIcon}
            />
          ) : (
            <IconStar size={DIAL_ICON_SIZE.SM} />
          )
        }
        onClick={handleToggle}
      />
    </div>
  );
};
