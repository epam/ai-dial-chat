import {
  IconDots,
  IconFolderPlus,
  IconPencilMinus,
  IconTrashX,
} from '@tabler/icons-react';
import { MouseEventHandler } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { HighlightColor } from '@/src/types/components';

import { Menu, MenuItem } from './DropdownMenu';

interface FolderContextMenuProps {
  onDelete?: MouseEventHandler<unknown>;
  onRename?: MouseEventHandler<unknown>;
  onAddFolder?: MouseEventHandler;
  highlightColor: HighlightColor;
}
export const FolderContextMenu = ({
  onDelete,
  onRename,
  onAddFolder,
  highlightColor,
}: FolderContextMenuProps) => {
  const { t } = useTranslation('sidebar');

  const highlightBg = classNames(
    highlightColor === 'green' ? 'hover:bg-green/15' : 'hover:bg-violet/15',
  );

  if (!onDelete && !onRename && !onAddFolder) {
    return null;
  }

  return (
    <Menu
      type="contextMenu"
      className="justify-self-end"
      trigger={
        <IconDots
          className="text-gray-500"
          size={18}
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      }
    >
      {onRename && (
        <MenuItem
          className={highlightBg}
          item={
            <div className="flex items-center gap-3">
              <IconPencilMinus className="shrink-0 text-gray-500" size={18} />
              <span>{t('Rename')}</span>
            </div>
          }
          onClick={onRename}
        />
      )}
      {onDelete && (
        <MenuItem
          className={highlightBg}
          item={
            <div className="flex items-center gap-3">
              <IconTrashX className="shrink-0 text-gray-500" size={18} />
              <span>{t('Delete')}</span>
            </div>
          }
          onClick={onDelete}
        />
      )}
      {onAddFolder && (
        <MenuItem
          className={highlightBg}
          item={
            <div className="flex items-center gap-3">
              <IconFolderPlus className="shrink-0 text-gray-500" size={18} />
              <span>{t('Add new folder')}</span>
            </div>
          }
          onClick={onAddFolder}
        />
      )}
    </Menu>
  );
};
