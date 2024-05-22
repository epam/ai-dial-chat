import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';
import { DialFile } from '@/src/types/files';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';

import CaretIconComponent from '@/src/components/Common/CaretIconComponent';
import { NoResultsFound } from '@/src/components/Common/NoResultsFound';
import Folder, { FolderProps } from '@/src/components/Folder/Folder';

interface Props<T, P = unknown> {
  folderProps: Omit<FolderProps<T, P>, 'currentFolder'>;
  handleFolderSelect: (folderId: string) => void;
  isAllEntitiesOpened: boolean;
  rootFolderName: string;
  rootFolderId: string;
  selectedFolderId?: string;
  initiallySelectedFolderId?: string;
  highlightTemporaryFolders?: boolean;
}

export const SelectFolderList = <T extends Conversation | Prompt | DialFile>({
  folderProps,
  handleFolderSelect,
  isAllEntitiesOpened,
  selectedFolderId,
  initiallySelectedFolderId,
  highlightTemporaryFolders,
  rootFolderName,
  rootFolderId,
}: Props<T>) => {
  const { t } = useTranslation(Translation.Chat);

  const highlightedFolders = useMemo(() => {
    return [selectedFolderId].filter(Boolean) as string[];
  }, [selectedFolderId]);

  return (
    <div className="flex min-h-[350px] flex-col overflow-auto">
      <button
        className={classNames(
          'mb-0.5 flex items-center gap-1 rounded border-l-2 py-1 text-xs text-secondary-bg-dark',
          selectedFolderId === rootFolderId
            ? 'border-tertiary bg-accent-primary-alpha'
            : 'border-transparent',
        )}
        onClick={() => handleFolderSelect(rootFolderId)}
      >
        <CaretIconComponent isOpen={isAllEntitiesOpened} />
        {t(rootFolderName)}
      </button>
      {isAllEntitiesOpened && (
        <div className="flex min-h-[250px] flex-col gap-0.5 overflow-auto">
          {folderProps.allFolders.length ? (
            <div className="flex flex-col gap-1 overflow-auto">
              {folderProps.allFolders.map((folder) => {
                if (
                  folder.folderId !== rootFolderId ||
                  (initiallySelectedFolderId &&
                    folder.originalId === initiallySelectedFolderId)
                ) {
                  return null;
                }

                return (
                  <div className="relative" key={folder.id}>
                    <Folder
                      {...folderProps}
                      maxDepth={MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH}
                      currentFolder={folder}
                      highlightedFolders={highlightedFolders}
                      highlightTemporaryFolders={highlightTemporaryFolders}
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
  );
};
