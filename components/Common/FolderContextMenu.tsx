import { MouseEventHandler } from 'react';
import { useTranslation } from 'react-i18next';

import DotsIcon from '../../public/images/icons/dots-vertical.svg';
import PenIcon from '../../public/images/icons/pen-line.svg';
import TrashIcon from '../../public/images/icons/trash.svg';
import { Menu, MenuItem } from './DropdownMenu';

interface FolderContextMenuProps {
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
}
export const FolderContextMenu = ({
  onDelete,
  onRename,
}: FolderContextMenuProps) => {
  const { t } = useTranslation('sidebar');

  return (
    <Menu
      className="justify-self-end"
      Icon={
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
        label={t('Edit')}
        Icon={
          <PenIcon className="text-gray-500" width={18} height={18} size={18} />
        }
        onClick={onRename}
      />
      <MenuItem
        label={t('Delete')}
        Icon={
          <TrashIcon
            className="text-gray-500"
            width={18}
            height={18}
            size={18}
          />
        }
        onClick={onDelete}
      />
    </Menu>
  );
};
