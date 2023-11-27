import { FloatingOverlay } from '@floating-ui/react';
import { IconFolderPlus } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { FolderInterface } from '@/src/types/folder';

import { PromptMoveToFolderProps } from '../Promptbar/components/Prompt';

import XmarkIcon from '../../../public/images/icons/xmark.svg';

interface MoveToFolderMobileModalProps {
  folders: FolderInterface[];
  onClose: () => void;
  onMoveToFolder: (args: { folderId?: string; isNewFolder?: boolean }) => void;
}

export const MoveToFolderMobileModal = ({
  folders,
  onMoveToFolder,
  onClose,
}: MoveToFolderMobileModalProps) => {
  const { t } = useTranslation('sidebar');
  const handleMoveToFolder = useCallback(
    ({ isNewFolder, folderId }: PromptMoveToFolderProps) => {
      onMoveToFolder({ isNewFolder, folderId });
      onClose();
    },
    [onMoveToFolder, onClose],
  );

  return (
    <FloatingOverlay className="z-50 flex items-center justify-center bg-gray-900/70 p-3 md:p-5">
      <div className="flex h-full w-full flex-col divide-y divide-gray-300 overflow-y-auto bg-gray-100 dark:divide-gray-900 dark:bg-gray-700">
        <div className="flex items-end justify-between px-3 pb-2 pt-4">
          <span className="h-min">{t('Move to')}</span>
          <span onClick={onClose}>
            <XmarkIcon width={24} height={24} className="text-gray-500" />
          </span>
        </div>
        <div
          className="flex h-[42px] gap-3  rounded px-6 py-2 hover:bg-green/15"
          onClick={() => {
            handleMoveToFolder({ isNewFolder: true });
          }}
        >
          <IconFolderPlus className="text-gray-500" size={18} />
          <span>{t('New folder')}</span>
        </div>
        <div className="overflow-auto py-2">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex h-[42px] items-center rounded px-6 hover:bg-green/15"
              onClick={() => {
                handleMoveToFolder({ folderId: folder.id });
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
