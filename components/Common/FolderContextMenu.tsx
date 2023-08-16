import { MouseEventHandler } from 'react';
import { useTranslation } from 'react-i18next';

import { HighlightColor } from '@/types/components';

import DotsIcon from '../../public/images/icons/dots-vertical.svg';
import PenIcon from '../../public/images/icons/pen-line.svg';
import TrashIcon from '../../public/images/icons/trash.svg';
import { Menu, MenuItem } from './DropdownMenu';

interface FolderContextMenuProps {
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
  highlightColor: HighlightColor;
}
export const FolderContextMenu = ({
  onDelete,
  onRename,
  highlightColor,
}: FolderContextMenuProps) => {
  const { t } = useTranslation('sidebar');

  return (
    <Menu
      type="contextMenu"
      className="justify-self-end"
      trigger={
        <DotsIcon
          className="text-gray-500"
          width={18}
          height={18}
          size={18}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
          }}
        />
      }
    >
      <MenuItem
        className={`${
          highlightColor === 'green'
            ? 'hover:bg-green/15'
            : 'hover:bg-violet/15'
        }`}
        item={
          <div className="flex items-center gap-3">
            <PenIcon
              className="shrink-0 text-gray-500"
              width={18}
              height={18}
              size={18}
            />
            <span>{t('Edit')}</span>
          </div>
        }
        onClick={onRename}
      />
      <MenuItem
        className={`${
          highlightColor === 'green'
            ? 'hover:bg-green/15'
            : 'hover:bg-violet/15'
        }`}
        item={
          <div className="flex items-center gap-3">
            <TrashIcon
              className="shrink-0 text-gray-500"
              width={18}
              height={18}
              size={18}
            />
            <span>{t('Delete')}</span>
          </div>
        }
        onClick={onDelete}
      />
    </Menu>
  );
};
