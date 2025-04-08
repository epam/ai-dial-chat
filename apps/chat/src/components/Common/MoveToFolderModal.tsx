import { IconFolderPlus } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { FolderInterface, MoveToFolderProps } from '@/src/types/folder';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { Modal } from './Modal';

interface Props {
  folders: FolderInterface[];
  onClose: () => void;
  onMoveToFolder: (args: { folderId?: string; isNewFolder?: boolean }) => void;
}

export const MoveToFolderModal = ({
  folders,
  onMoveToFolder,
  onClose,
}: Props) => {
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
      dataQa="move-to-folder-modal"
      state={ModalState.OPENED}
      containerClassName="flex w-[400px] py-4 md:py-6 h-full md:h-auto flex flex-col max-h-full md:h-[300px] max-w-[400px] md:min-w-[400px]"
      onClose={onClose}
    >
      <div className="flex size-full flex-col divide-y divide-tertiary overflow-y-auto bg-layer-3">
        <div className="flex items-end justify-between px-3 pb-4 md:px-6">
          <span className="h-min">{t('Move to')}</span>
        </div>
        <div className="px-3 py-1  md:px-6">
          <button
            className="flex h-[34px] w-full items-center gap-3 rounded px-3 hover:bg-accent-primary-alpha"
            onClick={() => {
              handleMoveToFolder({ isNewFolder: true });
            }}
          >
            <IconFolderPlus className="text-secondary" size={18} />
            <span>{t('New folder')}</span>
          </button>
        </div>
        <div className="gap-1 overflow-auto px-3 py-1 md:px-6">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex h-[34px] cursor-pointer items-center rounded px-3 hover:bg-accent-primary-alpha"
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
