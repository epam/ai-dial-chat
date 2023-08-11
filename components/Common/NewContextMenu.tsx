import { MouseEventHandler, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { Conversation } from '@/types/chat';
import { FeatureType } from '@/types/components';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import DotsIcon from '../../public/images/icons/dots-vertical.svg';
import FileLeftIcon from '../../public/images/icons/file-arrow-left.svg';
import FileRightIcon from '../../public/images/icons/file-arrow-right.svg';
import FolderPlusIcon from '../../public/images/icons/folder-plus.svg';
import PenIcon from '../../public/images/icons/pen-line.svg';
import ReplayIcon from '../../public/images/icons/replay.svg';
import CompareIcon from '../../public/images/icons/scale-balanced.svg';
import TrashIcon from '../../public/images/icons/trash.svg';
import { Menu, MenuItem } from './DropdownMenu';

import classNames from 'classnames';

interface ContextMenuProps {
  item: Conversation | Prompt;
  featureType: FeatureType;
  highlightColor: string;
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
        Icon={
          <DotsIcon
            className={classNames('text-gray-500', className)}
            width={18}
            height={18}
            size={18}
          />
        }
      >
        <MenuItem
          className={classNames(`hover:bg-${highlightColor}`)}
          label={t('Edit')}
          Icon={
            <PenIcon
              className="text-gray-500"
              width={18}
              height={18}
              size={18}
            />
          }
          onClick={onRename}
        />
        {onCompare && (
          <MenuItem
            className={classNames(`hover:bg-${highlightColor}`)}
            label={t('Compare')}
            Icon={
              <CompareIcon
                className="text-gray-500"
                width={18}
                height={18}
                size={18}
              />
            }
            onClick={onCompare}
          />
        )}
        {!isEmptyConversation && onReplay && (
          <MenuItem
            className={classNames(`hover:bg-${highlightColor}`)}
            label={t('Replay')}
            Icon={
              <ReplayIcon
                className="text-gray-500"
                width={18}
                height={18}
                size={18}
              />
            }
            onClick={onReplay}
          />
        )}
        <MenuItem
          className={classNames(`hover:bg-${highlightColor}`)}
          label={t('Export')}
          Icon={
            <FileLeftIcon
              className="text-gray-500"
              width={18}
              height={18}
              size={18}
            />
          }
          onClick={onExport}
        />
        <MenuItem
          className={classNames('md:hidden', `hover:bg-${highlightColor}`)}
          onClick={onOpenMoveToModal}
          label="Move to"
          Icon={
            <FileRightIcon
              className="text-gray-500"
              width={18}
              height={18}
              size={18}
            />
          }
        />
        <Menu
          className={classNames('max-md:hidden', `hover:bg-${highlightColor}`)}
          label="Move to"
          Icon={
            <FileRightIcon
              className="text-gray-500"
              width={18}
              height={18}
              size={18}
            />
          }
        >
          <MenuItem
            className={classNames(
              'border-b border-gray-400 dark:border-gray-600 max-md:hidden',
              `hover:bg-${highlightColor}`,
            )}
            label="New folder"
            onClick={moveToNewFolder}
            Icon={
              <FolderPlusIcon
                className="text-gray-500"
                width={18}
                height={18}
                size={18}
              />
            }
          />
          {folders
            .filter((folder) => folder.type === featureType)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((folder) => (
              <MenuItem
                className={classNames(
                  'max-md:hidden',
                  `hover:bg-${highlightColor}`,
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
    </>
  );
};
