import { useId } from '@floating-ui/react';
import { ChangeEvent, useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  notAllowedSymbols,
  notAllowedSymbolsRegex,
} from '@/src/utils/app/file';
import {
  getChildAndCurrentFoldersIdsById,
  getPathToFolderById,
} from '@/src/utils/app/folders';
import { PublishedWithMeFilter } from '@/src/utils/app/search';

import { FolderInterface } from '@/src/types/folder';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import CaretIconComponent from '@/src/components/Common/CaretIconComponent';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import Modal from '@/src/components/Common/Modal';
import { NoResultsFound } from '@/src/components/Common/NoResultsFound';
import Folder from '@/src/components/Folder/Folder';

import FolderPlus from '@/public/images/icons/folder-plus.svg';

interface Props {
  type: SharingType;
  isOpen: boolean;
  onClose: (path: string | undefined) => void;
  initiallySelectedFolderId: string;
}

export const ChangePathDialog = ({
  isOpen,
  onClose,
  type,
  initiallySelectedFolderId,
}: Props) => {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const headingId = useId();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAllFilesOpened, setIsAllFilesOpened] = useState(true);
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    '',
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const highlightedFolders = useMemo(() => {
    return [selectedFolderId].filter(Boolean) as string[];
  }, [selectedFolderId]);

  const { selectors, actions } =
    type === SharingType.Conversation || type === SharingType.ConversationFolder
      ? { selectors: ConversationsSelectors, actions: ConversationsActions }
      : { selectors: PromptsSelectors, actions: PromptsActions };

  const folders = useAppSelector((state) =>
    selectors.selectTemporaryAndFilteredFolders(state, PublishedWithMeFilter),
  );
  const filteredFolders: FolderInterface[] = useMemo(() => {
    return folders.filter(({ name }) =>
      name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [folders, searchQuery]);

  const handleSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleToggleFolder = useCallback(
    (folderId?: string) => {
      if (!folderId) {
        setIsAllFilesOpened((value) => !value);
        setOpenedFoldersIds([]);
        setSelectedFolderId(folderId);
        return;
      }

      if (openedFoldersIds.includes(folderId)) {
        const childFolders = getChildAndCurrentFoldersIdsById(
          folderId,
          filteredFolders,
        );
        setOpenedFoldersIds(
          openedFoldersIds.filter((id) => !childFolders.includes(id)),
        );
      } else {
        setOpenedFoldersIds(openedFoldersIds.concat(folderId));
      }
    },
    [filteredFolders, openedFoldersIds],
  );

  const handleFolderSelect = useCallback(
    (folderId: string) => {
      setSelectedFolderId(folderId);
      handleToggleFolder(folderId);
    },
    [handleToggleFolder],
  );

  const handleRenameFolder = useCallback(
    (newName: string, folderId: string) => {
      const renamingFolder = filteredFolders.find(
        (folder) => folder.id === folderId,
      );
      const folderWithSameName = filteredFolders.find(
        (folder) =>
          folder.name === newName.trim() &&
          folderId !== folder.id &&
          folder.folderId === renamingFolder?.folderId,
      );

      if (folderWithSameName) {
        setErrorMessage(
          t('Not allowed to have folders with same names') as string,
        );
        return;
      }
      if (newName.match(notAllowedSymbolsRegex)) {
        setErrorMessage(
          t(
            `The symbols ${notAllowedSymbols.join(
              '',
            )} are not allowed in folder name`,
          ) as string,
        );
        return;
      }

      dispatch(actions.renameTemporaryFolder({ folderId, name: newName }));
    },
    [actions, dispatch, filteredFolders, t],
  );

  const handleAddFolder = useCallback(
    (parentFolderId?: string) => {
      dispatch(
        actions.createTemporaryFolder({
          relativePath: parentFolderId,
        }),
      );

      if (parentFolderId && !openedFoldersIds.includes(parentFolderId)) {
        setOpenedFoldersIds(openedFoldersIds.concat(parentFolderId));
      }
    },
    [actions, dispatch, openedFoldersIds],
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) =>
      dispatch(
        actions.deleteTemporaryFolder({
          folderId,
        }),
      ),
    [actions, dispatch],
  );

  return (
    <Modal
      portalId="theme-main"
      isOpen={isOpen}
      onClose={() => onClose(undefined)}
      dataQa="change-path-dialog"
      containerClassName="flex min-w-full flex-col gap-4 md:min-w-[425px] md:max-w-full"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="flex flex-col gap-2 overflow-auto">
        <div className="flex justify-between px-6 pt-4">
          <h2 id={headingId} className="text-base font-semibold">
            {t('Change path')}
          </h2>
        </div>
        <div className="group/modal flex flex-col gap-2 overflow-auto px-6 pb-4">
          <ErrorMessage error={errorMessage} />
          <input
            name="titleInput"
            placeholder={t('Search folders') || ''}
            type="text"
            onChange={handleSearch}
            className="m-0 w-full rounded border border-primary bg-transparent px-3 py-2 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
            value={searchQuery}
          />
          <div className="flex min-h-[350px] flex-col overflow-auto">
            <button
              className={classNames(
                'mb-0.5 flex items-center gap-1 rounded border-l-2 py-1 text-xs text-secondary',
                !selectedFolderId
                  ? 'border-accent-primary bg-accent-primary-alpha'
                  : 'border-transparent',
              )}
              onClick={() => handleToggleFolder()}
            >
              <CaretIconComponent isOpen={isAllFilesOpened} />
              {t('Organization')}
            </button>
            {isAllFilesOpened && (
              <div className="flex min-h-[250px] flex-col gap-0.5 overflow-auto">
                {filteredFolders.length ? (
                  <div className="flex flex-col gap-1 overflow-auto">
                    {filteredFolders.map((folder) => {
                      if (
                        folder.folderId ||
                        folder.originalId === initiallySelectedFolderId
                      ) {
                        return null;
                      }

                      return (
                        <div
                          className={classNames(
                            'relative',
                            folder.temporary
                              ? 'text-primary'
                              : 'text-secondary',
                          )}
                          key={folder.id}
                        >
                          <Folder
                            searchTerm={searchQuery}
                            currentFolder={folder}
                            allFolders={filteredFolders}
                            highlightedFolders={highlightedFolders}
                            isInitialRenameEnabled
                            openedFoldersIds={openedFoldersIds}
                            onClickFolder={handleFolderSelect}
                            onRenameFolder={handleRenameFolder}
                            onDeleteFolder={handleDeleteFolder}
                            onAddFolder={handleAddFolder}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex grow items-center justify-center">
                    <NoResultsFound />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-primary px-6 py-4">
          <div className="flex items-center justify-center">
            <button
              onClick={() => handleAddFolder()}
              className="flex h-[34px] w-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
            >
              <FolderPlus
                height={24}
                width={24}
                className="text-secondary hover:text-accent-primary"
              />
            </button>
          </div>
          <div>
            <button
              onClick={() =>
                onClose(getPathToFolderById(filteredFolders, selectedFolderId))
              }
              className="button button-primary"
            >
              {t('Select folder')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
