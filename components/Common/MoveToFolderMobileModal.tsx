import { FloatingOverlay } from '@floating-ui/react';
import { IconFolderPlus } from '@tabler/icons-react';
import { useContext } from 'react';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/types/chat';
import { FeatureType } from '@/types/components';
import { Prompt } from '@/types/prompt';

import HomeContext from '@/pages/api/home/home.context';

import XmarkIcon from '../../public/images/icons/xmark.svg';

interface MoveToFolderMobileModalProps {
  item: Conversation | Prompt;
  featureType: FeatureType;
  onClose: () => void;
  moveToFolder?: (folderId: string) => void;
}

export const MoveToFolderMobileModal = ({
  item,
  moveToFolder,
  featureType,
  onClose,
}: MoveToFolderMobileModalProps) => {
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
    <FloatingOverlay className="z-50 flex items-center justify-center bg-gray-900/70 p-3">
      <div className="flex h-full w-full flex-col divide-y divide-gray-300 bg-gray-100 dark:divide-gray-900 dark:bg-gray-700">
        <div className="flex items-end justify-between px-3 pb-2 pt-4">
          <span className="h-min">Move to</span>
          <span onClick={onClose}>
            <XmarkIcon width={24} height={24} className="text-gray-500" />
          </span>
        </div>
        <div
          className="flex h-[42px] gap-3  rounded px-6 py-2 hover:bg-green/15"
          onClick={moveToNewFolder}
        >
          <IconFolderPlus className="text-gray-500" size={18} />
          <span>New folder</span>
        </div>
        <div className="py-2">
          {folders
            .filter((folder) => folder.type === featureType)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((folder) => (
              <div
                key={folder.id}
                className="flex h-[42px] items-center rounded px-6 hover:bg-green/15"
                onClick={() => {
                  moveToFolder
                    ? moveToFolder(folder.id)
                    : moveConversationToFolder(folder.id);
                }}
              >
                <span>{folder.name}</span>
              </div>
            ))}
        </div>
      </div>
    </FloatingOverlay>
  );
};
