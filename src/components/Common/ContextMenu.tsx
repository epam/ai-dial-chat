import {
  IconFileArrowRight,
  IconFolderPlus,
  IconFolderShare,
  IconPencilMinus,
  IconPlayerPlay,
  IconRefreshDot,
  IconScale,
  IconTrashX,
} from '@tabler/icons-react';
import { MouseEventHandler } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FeatureType, HighlightColor } from '@/src/types/components';
import { FolderInterface } from '@/src/types/folder';

import DotsIcon from '../../../public/images/icons/dots-vertical.svg';
import { Menu, MenuItem } from './DropdownMenu';

interface ContextMenuProps {
  folders: FolderInterface[];
  featureType: FeatureType;
  highlightColor: HighlightColor;
  isEmptyConversation?: boolean;
  className?: string;
  onOpenMoveToModal: () => void;
  onMoveToFolder: (args: { folderId?: string; isNewFolder?: boolean }) => void;
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
  onExport: MouseEventHandler<unknown>;
  onReplay?: MouseEventHandler<HTMLButtonElement>;
  onCompare?: MouseEventHandler<unknown>;
  onPlayback?: MouseEventHandler<HTMLButtonElement>;
}

export const ContextMenu = ({
  featureType,
  isEmptyConversation,
  className,
  highlightColor,
  folders,
  onDelete,
  onRename,
  onExport,
  onReplay,
  onCompare,
  onPlayback,
  onMoveToFolder,
  onOpenMoveToModal,
}: ContextMenuProps) => {
  const { t } = useTranslation('sidebar');
  return (
    <>
      <Menu
        type="contextMenu"
        trigger={
          <DotsIcon
            className={classNames('rotate-90 text-gray-500', className)}
            width={18}
            height={18}
            size={18}
          />
        }
      >
        <MenuItem
          className={classNames(
            highlightColor === 'green'
              ? 'hover:bg-green/15'
              : 'hover:bg-violet/15',
          )}
          item={
            <div className="flex items-center gap-3">
              <IconPencilMinus className="shrink-0 text-gray-500" size={18} />
              <span>{featureType === 'chat' ? t('Rename') : t('Edit')}</span>
            </div>
          }
          onClick={onRename}
        />
        {onCompare && (
          <MenuItem
            className={classNames(
              highlightColor === 'green'
                ? 'hover:bg-green/15'
                : 'hover:bg-violet/15',
            )}
            item={
              <div className="flex items-center gap-3">
                <IconScale className="shrink-0 text-gray-500" size={18} />
                <span>{t('Compare')}</span>
              </div>
            }
            onClick={onCompare}
          />
        )}
        {!isEmptyConversation && onReplay && (
          <MenuItem
            className={classNames(
              highlightColor === 'green'
                ? 'hover:bg-green/15'
                : 'hover:bg-violet/15',
            )}
            item={
              <div className="flex items-center gap-3">
                <IconRefreshDot className="shrink-0 text-gray-500" size={18} />
                <span>{t('Replay')}</span>
              </div>
            }
            onClick={onReplay}
          />
        )}
        {!isEmptyConversation && onPlayback && (
          <MenuItem
            className="hover:bg-green/15"
            item={
              <div className="flex items-center gap-3">
                <IconPlayerPlay className="shrink-0 text-gray-500" size={18} />
                <span>{t('Playback')}</span>
              </div>
            }
            onClick={onPlayback}
          />
        )}
        <MenuItem
          className={classNames(
            highlightColor === 'green'
              ? 'hover:bg-green/15'
              : 'hover:bg-violet/15',
          )}
          item={
            <div className="flex items-center gap-3">
              <IconFileArrowRight
                className="shrink-0 text-gray-500"
                size={18}
              />
              <span>{t('Export')}</span>
            </div>
          }
          onClick={onExport}
        />
        <MenuItem
          className={classNames(
            'md:hidden',

            highlightColor === 'green'
              ? 'hover:bg-green/15'
              : 'hover:bg-violet/15',
          )}
          onClick={onOpenMoveToModal}
          item={
            <div className="flex items-center gap-3">
              <IconFolderShare className="shrink-0 text-gray-500" size={18} />
              <span>{t('Move to')}</span>
            </div>
          }
        />
        <Menu
          type="contextMenu"
          className={classNames(
            'max-md:hidden',

            highlightColor === 'green'
              ? 'hover:bg-green/15'
              : 'hover:bg-violet/15',
          )}
          trigger={
            <div className="flex items-center gap-3">
              <IconFolderShare className="shrink-0 text-gray-500" size={18} />
              <span>{t('Move to')}</span>
            </div>
          }
        >
          <MenuItem
            className={classNames(
              {
                'border-b border-gray-400 dark:border-gray-600':
                  folders?.length > 0,
              },
              'invisible md:visible',

              highlightColor === 'green'
                ? 'hover:bg-green/15'
                : 'hover:bg-violet/15',
            )}
            onClick={() => {
              onMoveToFolder({ isNewFolder: true });
            }}
            item={
              <div className="flex items-center gap-3">
                <IconFolderPlus className="shrink-0 text-gray-500" size={18} />
                <span>{t('New folder')}</span>
              </div>
            }
          />

          {folders.map((folder) => (
            <MenuItem
              className={classNames(
                'invisible md:visible',

                highlightColor === 'green'
                  ? 'hover:bg-green/15'
                  : 'hover:bg-violet/15',
              )}
              key={folder.id}
              label={folder.name}
              onClick={() => {
                onMoveToFolder({ folderId: folder.id });
              }}
            />
          ))}
        </Menu>

        <MenuItem
          className={classNames(
            highlightColor === 'green'
              ? 'hover:bg-green/15'
              : 'hover:bg-violet/15',
          )}
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
