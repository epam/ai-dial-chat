import {
  IconFileArrowRight,
  IconFolderPlus,
  IconFolderShare,
  IconPencilMinus,
  IconRefreshDot,
  IconScale,
  IconTrashX,
} from '@tabler/icons-react';
import { MouseEventHandler, useContext } from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';
import { FeatureType, HighlightColor } from '@/types/components';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import DotsIcon from '../../public/images/icons/dots-vertical.svg';
import { Menu, MenuItem } from './DropdownMenu';

import classNames from 'classnames';

interface ContextMenuProps {
  item: Conversation | Prompt;
  featureType: FeatureType;
  highlightColor: HighlightColor;
  onOpenMoveToModal: () => void;
  moveToFolder?: (folderId: string) => void;
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
  onExport: MouseEventHandler<unknown>;
  onReplay?: MouseEventHandler<HTMLButtonElement>;
  onCompare?: MouseEventHandler<unknown>;
  isEmptyConversation?: boolean;
  className?: string;
}

export const ContextMenu = ({
  item,
  featureType,
  onDelete,
  onRename,
  onExport,
  onReplay,
  onCompare,
  isEmptyConversation,
  className,
  moveToFolder,
  onOpenMoveToModal,
  highlightColor,
}: ContextMenuProps) => {
  const { t } = useTranslation('sidebar');
  const {
    state: { folders },
    handleCreateFolder,
    handleUpdateConversation,
  } = useContext(HomeContext);

  const moveConversationToFolder = (folderId: string) => {
    if (featureType === 'chat') {
      handleUpdateConversation(item as Conversation, {
        key: 'folderId',
        value: folderId,
      });
    }
  };

  const moveToNewFolder = () => {
    const newFolder = handleCreateFolder(t('New folder'), featureType);
    if (featureType === 'chat') {
      moveConversationToFolder(newFolder.id);
    }
    if (moveToFolder) {
      moveToFolder(newFolder.id);
    }
  };
  return (
    <>
      <Menu
        type="contextMenu"
        trigger={
          <DotsIcon
            className={classNames('text-gray-500', className)}
            width={18}
            height={18}
            size={18}
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
              <span>{featureType === 'chat' ? t('Rename') : t('Edit')}</span>
            </div>
          }
          onClick={onRename}
        />
        {onCompare && (
          <MenuItem
            className={`${
              highlightColor === 'green'
                ? 'hover:bg-green/15'
                : 'hover:bg-violet/15'
            }`}
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
            className={`${
              highlightColor === 'green'
                ? 'hover:bg-green/15'
                : 'hover:bg-violet/15'
            }`}
            item={
              <div className="flex items-center gap-3">
                <IconRefreshDot className="shrink-0 text-gray-500" size={18} />
                <span>{t('Replay')}</span>
              </div>
            }
            onClick={onReplay}
          />
        )}
        <MenuItem
          className={`${
            highlightColor === 'green'
              ? 'hover:bg-green/15'
              : 'hover:bg-violet/15'
          }`}
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
            `${
              highlightColor === 'green'
                ? 'hover:bg-green/15'
                : 'hover:bg-violet/15'
            }`,
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
            `${
              highlightColor === 'green'
                ? 'hover:bg-green/15'
                : 'hover:bg-violet/15'
            }`,
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
              `${
                folders?.length > 0
                  ? 'border-b border-gray-400 dark:border-gray-600'
                  : ''
              }`,
              'max-md:hidden',
              `${
                highlightColor === 'green'
                  ? 'hover:bg-green/15'
                  : 'hover:bg-violet/15'
              }`,
            )}
            onClick={moveToNewFolder}
            item={
              <div className="flex items-center gap-3">
                <IconFolderPlus className="shrink-0 text-gray-500" size={18} />
                <span>{t('New folder')}</span>
              </div>
            }
          />
          {folders
            .filter((folder) => folder.type === featureType)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((folder) => (
              <MenuItem
                className={classNames(
                  'max-md:hidden',
                  `${
                    highlightColor === 'green'
                      ? 'hover:bg-green/15'
                      : 'hover:bg-violet/15'
                  }`,
                )}
                key={folder.id}
                label={folder.name}
                onClick={() => {
                  moveToFolder
                    ? moveToFolder(folder.id)
                    : moveConversationToFolder(folder.id);
                }}
              />
            ))}
        </Menu>
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
    </>
  );
};
