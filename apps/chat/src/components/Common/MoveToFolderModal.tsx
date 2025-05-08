import { IconFolderPlus } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { FeatureType } from '@/src/types/common';
import { FolderInterface, MoveToFolderProps } from '@/src/types/folder';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';

import { Modal } from './Modal';

interface FolderViewProps {
  folder: FolderInterface;
  allFolders: FolderInterface[];
  onClick: ({ folderId }: { folderId: string }) => void;
  index?: number;
}

const FolderView = ({
  folder,
  allFolders,
  onClick,
  index = 0,
}: FolderViewProps) => {
  const subFolders = useMemo(() => {
    const allSubFolders = allFolders.filter((subFolder) =>
      subFolder.folderId.startsWith(folder.id),
    );
    const visibleSubFolders = allSubFolders.filter(
      (subFolder) => subFolder.folderId === folder.id,
    );

    return { allSubFolders, visibleSubFolders };
  }, [folder, allFolders]);

  const handleFolderClick = useCallback(() => {
    onClick({ folderId: folder.id });
  }, [folder, onClick]);

  return (
    <div
      key={folder.id}
      // eslint-disable-next-line tailwindcss/no-custom-classname
      className={classNames(
        'flex cursor-pointer flex-col justify-center rounded py-2 pr-3 hover:bg-accent-primary-alpha',
        `pl-${3 + index}`,
      )}
      onClick={handleFolderClick}
    >
      <span>{folder.name}</span>
      {!!subFolders.visibleSubFolders.length &&
        subFolders.visibleSubFolders.map((subFolder) => (
          <FolderView
            key={subFolder.id}
            folder={subFolder}
            allFolders={subFolders.allSubFolders}
            onClick={onClick}
            index={index + 1}
          />
        ))}
    </div>
  );
};

interface Props {
  folders: FolderInterface[];
  onClose: () => void;
  onMoveToFolder: (args: { folderId?: string; isNewFolder?: boolean }) => void;
  featureType: FeatureType;
}

export const MoveToFolderModal = ({
  folders,
  onMoveToFolder,
  onClose,
  featureType,
}: Props) => {
  const { t } = useTranslation(Translation.SideBar);

  const allFoldersSelector = useMemo(() => {
    switch (featureType) {
      case FeatureType.Chat:
        return ConversationsSelectors.selectFolders;
      case FeatureType.Prompt:
      default:
        return PromptsSelectors.selectFolders;
    }
  }, [featureType]);
  const allFolders = useAppSelector(allFoldersSelector);

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
            <FolderView
              key={folder.id}
              folder={folder}
              allFolders={allFolders}
              onClick={handleMoveToFolder}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
};
