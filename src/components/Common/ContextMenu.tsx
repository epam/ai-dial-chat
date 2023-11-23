import {
  IconDots,
  IconFileArrowRight,
  IconFolderPlus,
  IconFolderShare,
  IconPencilMinus,
  IconPlayerPlay,
  IconRefreshDot,
  IconScale,
  IconTrashX,
  IconUserShare,
} from '@tabler/icons-react';
import { MouseEventHandler } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { FeatureType, HighlightColor } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';

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
  onOpenShareModal?: MouseEventHandler<HTMLButtonElement>;
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
  onOpenShareModal,
}: ContextMenuProps) => {
  const { t } = useTranslation('sidebar');
  return (
    <>
      <Menu
        type="contextMenu"
        trigger={
          <IconDots
            className={classNames('text-gray-500', className)}
            size={16}
          />
        }
      >
        <MenuItem
          className={getByHighlightColor(
            highlightColor,
            'hover:bg-green/15',
            'hover:bg-violet/15',
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
            className={getByHighlightColor(
              highlightColor,
              'hover:bg-green/15',
              'hover:bg-violet/15',
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
            className={getByHighlightColor(
              highlightColor,
              'hover:bg-green/15',
              'hover:bg-violet/15',
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
          className={getByHighlightColor(
            highlightColor,
            'hover:bg-green/15',
            'hover:bg-violet/15',
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
            getByHighlightColor(
              highlightColor,
              'hover:bg-green/15',
              'hover:bg-violet/15',
            ),
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
            getByHighlightColor(
              highlightColor,
              'hover:bg-green/15',
              'hover:bg-violet/15',
            ),
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
              getByHighlightColor(
                highlightColor,
                'hover:bg-green/15',
                'hover:bg-violet/15',
              ),
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
                getByHighlightColor(
                  highlightColor,
                  'hover:bg-green/15',
                  'hover:bg-violet/15',
                ),
              )}
              key={folder.id}
              label={folder.name}
              onClick={() => {
                onMoveToFolder({ folderId: folder.id });
              }}
            />
          ))}
        </Menu>

        {onOpenShareModal && (
          <MenuItem
            className={getByHighlightColor(
              highlightColor,
              'hover:bg-green/15',
              'hover:bg-violet/15',
            )}
            onClick={onOpenShareModal}
            item={
              <div className="flex items-center gap-3">
                <IconUserShare className="shrink-0 text-gray-500" size={18} />
                <span>{t('Share')}</span>
              </div>
            }
          />
        )}

        <MenuItem
          className={getByHighlightColor(
            highlightColor,
            'hover:bg-green/15',
            'hover:bg-violet/15',
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
