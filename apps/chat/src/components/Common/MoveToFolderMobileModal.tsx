import { FloatingOverlay } from '@floating-ui/react';
import { IconFolderPlus, IconX } from '@tabler/icons-react';
import { useCallback, useEffect } from 'react';

import { useTranslation } from 'next-i18next';

import { FolderInterface, MoveToFolderProps } from '@/src/types/folder';
import { Translation } from '@/src/types/translation';

interface MoveToFolderMobileModalProps {
  folders: FolderInterface[];
  onOpen?: () => void;
  onClose: () => void;
  onMoveToFolder: (args: { folderId?: string; isNewFolder?: boolean }) => void;
}

export const MoveToFolderMobileModal = ({
  folders,
  onOpen,
  onMoveToFolder,
  onClose,
}: MoveToFolderMobileModalProps) => {
  const { t } = useTranslation(Translation.Common);
  const handleMoveToFolder = useCallback(
    ({ isNewFolder, folderId }: MoveToFolderProps) => {
      onMoveToFolder({ isNewFolder, folderId });
      onClose();
    },
    [onMoveToFolder, onClose],
  );

  useEffect(() => {
    onOpen?.();
  }, [onOpen]);

  return (
    <FloatingOverlay className="z-50 flex items-center justify-center bg-blackout p-3 md:p-5">
      <div className="flex size-full flex-col divide-y divide-tertiary overflow-y-auto bg-layer-3">
        <div className="flex items-end justify-between px-3 pb-2 pt-4">
          <span className="h-min">{t('common.button.move_to')}</span>
          <span onClick={onClose}>
            <IconX width={24} height={24} className="text-secondary-bg-dark" />
          </span>
        </div>
        <div
          className="flex h-[42px] gap-3  rounded px-6 py-2 hover:bg-accent-primary-alpha"
          onClick={() => {
            handleMoveToFolder({ isNewFolder: true });
          }}
        >
          <IconFolderPlus className="text-secondary-bg-dark" size={18} />
          <span>{t('common.button.new_folder')}</span>
        </div>
        <div className="overflow-auto py-2">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex h-[42px] items-center rounded px-6 hover:bg-accent-primary-alpha"
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
