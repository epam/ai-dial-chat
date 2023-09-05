import { IconPencilMinus, IconTrashX } from '@tabler/icons-react';
import { MouseEventHandler } from 'react';

import { useTranslation } from 'next-i18next';

import { HighlightColor } from '@/src/types/components';

import DotsIcon from '../../../public/images/icons/dots-vertical.svg';
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
            <IconPencilMinus className="shrink-0 text-gray-500" size={18} />
            <span>{t('Rename')}</span>
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
            <IconTrashX className="shrink-0 text-gray-500" size={18} />
            <span>{t('Delete')}</span>
          </div>
        }
        onClick={onDelete}
      />
    </Menu>
  );
};
