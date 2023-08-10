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
import PromptbarContext from '../Promptbar/PromptBar.context';
import { Menu, MenuItem } from './DropdownMenu';

import classNames from 'classnames';

interface ContextMenuProps {
  conversation?: Conversation;
  prompt?: Prompt;
  featureType: FeatureType;
  onDelete: MouseEventHandler<unknown>;
  onRename: MouseEventHandler<unknown>;
  onExport: MouseEventHandler<unknown>;
  onReplay?: MouseEventHandler<HTMLButtonElement>;
  onCompare?: MouseEventHandler<unknown>;
  isEmptyConversation?: boolean;
  className?: string;
}

export const ContextMenu = ({
  conversation,
  prompt,
  featureType,
  onDelete,
  onRename,
  onExport,
  onReplay,
  onCompare,
  isEmptyConversation,
  className,
}: ContextMenuProps) => {
  const { t } = useTranslation('sidebar');
  const {
    state: { folders },
    handleCreateFolder,
    handleUpdateConversation,
  } = useContext(HomeContext);

  const { handleUpdatePrompt } = useContext(PromptbarContext);

  const moveConversationToFolder = (folderId: string) => {
    if (conversation) {
      handleUpdateConversation(conversation, {
        key: 'folderId',
        value: folderId,
      });
    }
  };
  const movePromptToFolder = (folderId: string) => {
    if (prompt) {
      const newPrompt = { ...prompt, folderId: folderId };
      prompt.folderId;
      handleUpdatePrompt(newPrompt);
    }
  };
  const moveToNewFolder = () => {
    const newFolder = handleCreateFolder(t('New folder'), featureType);
    moveConversationToFolder(newFolder.id);
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
        <Menu
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
            // style={{ borderBottom: '1px solid' }}
            className="border-b border-gray-400 dark:border-gray-600"
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
                key={folder.id}
                label={folder.name}
                onClick={() => {
                  conversation
                    ? moveConversationToFolder(folder.id)
                    : movePromptToFolder(folder.id);
                }}
              />
            ))}
        </Menu>
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
    </>
  );
};
