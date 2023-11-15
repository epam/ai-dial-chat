import { IconDownload, IconTrashX } from '@tabler/icons-react';
import { MouseEventHandler } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { DialFile } from '@/src/types/files';

import { stopBubbling } from '@/src/constants/chat';

import DotsIcon from '../../../public/images/icons/dots-vertical.svg';
import { Menu, MenuItem } from '../Common/DropdownMenu';

interface ContextMenuProps {
  file: DialFile;
  className: string;
  onDelete: MouseEventHandler<unknown>;
}

export const FileItemContextMenu = ({
  file,
  className,
  onDelete,
}: ContextMenuProps) => {
  const { t } = useTranslation('sidebar');
  return (
    <>
      <Menu
        type="contextMenu"
        trigger={
          <DotsIcon
            className={classNames('rotate-90 text-gray-500')}
            width={18}
            height={18}
            size={18}
          />
        }
        className={className}
      >
        {file.status !== 'UPLOADING' && file.status !== 'FAILED' && (
          <MenuItem
            className="hover:bg-blue-500/20"
            item={
              <a
                download={file.name}
                href={`api/files?path=${[file.absolutePath, file.name].join(
                  '/',
                )}`}
                onClick={stopBubbling}
                className="flex gap-3"
              >
                <IconDownload size={18} className="text-gray-500" />
                <span>{t('Download')}</span>
              </a>
            }
          />
        )}

        <MenuItem
          className="hover:bg-blue-500/20"
          item={
            <div className="flex items-center gap-3">
              <IconTrashX className="shrink-0 text-gray-500" size={18} />
              <span>{t('Delete')}</span>
            </div>
          }
          onClick={onDelete}
        />
      </Menu>
    </>
  );
};
