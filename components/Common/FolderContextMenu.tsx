import { MouseEventHandler } from 'react';
import { useTranslation } from 'react-i18next';

import DotsIcon from '../../public/images/icons/dots-vertical.svg';
import PenIcon from '../../public/images/icons/pen-line.svg';
import TrashIcon from '../../public/images/icons/trash.svg';
import { Menu, MenuItem } from './DropdownMenu';

import classNames from 'classnames';

interface FolderContextMenuProps {
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
  highlightColor: string;
}
export const FolderContextMenu = ({
  onDelete,
  onRename,
  highlightColor,
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
        className={classNames(`hover:bg-${highlightColor}`)}
        label={t('Edit')}
        Icon={
          <PenIcon className="text-gray-500" width={18} height={18} size={18} />
        }
        onClick={onRename}
      />
      <MenuItem
        className={classNames(`hover:bg-${highlightColor}`)}
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
