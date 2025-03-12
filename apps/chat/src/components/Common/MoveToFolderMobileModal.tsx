import { IconFolderPlus } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { FolderInterface, MoveToFolderProps } from '@/src/types/folder';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { Modal } from './Modal';

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
  const { t } = useTranslation(Translation.SideBar);

  const handleMoveToFolder = useCallback(
    ({ isNewFolder, folderId }: MoveToFolderProps) => {
      onMoveToFolder({ isNewFolder, folderId });
      onClose();
    },
    [onMoveToFolder, onClose],
  );

  return (
    <Modal
      portalId="theme-main"
      dataQa="move-to-mobile"
      state={ModalState.OPENED}
      containerClassName="flex min-w-full w-full h-full"
      onClose={onClose}
    >
      <div className="flex size-full flex-col divide-y divide-tertiary overflow-y-auto bg-layer-3">
        <div className="flex items-end justify-between px-3 pb-2 pt-4">
          <span className="h-min">{t('Move to')}</span>
        </div>
        <div
          className="flex h-[42px] gap-3  rounded px-6 py-2 hover:bg-accent-primary-alpha"
          onClick={() => {
            handleMoveToFolder({ isNewFolder: true });
          }}
        >
          <IconFolderPlus className="text-secondary" size={18} />
          <span>{t('New folder')}</span>
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
    </Modal>
  );
};
