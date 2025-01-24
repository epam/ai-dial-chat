import { useMemo } from 'react';

import classNames from 'classnames';

import { isConversationId, isFileId, isRootId } from '@/src/utils/app/id';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { Prompt } from '@/src/types/prompt';

import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';

import { NoResultsFound } from '@/src/components/Common/NoResultsFound';
import Folder, { FolderProps } from '@/src/components/Folder/Folder';

import CollapsibleSection from '../CollapsibleSection';
import { NoData } from '../NoData';

interface Props<T, P = unknown> {
  folderProps: Omit<FolderProps<T, P>, 'currentFolder' | 'featureType'>;
  handleFolderSelect: (folderId: string) => void;
  isAllEntitiesOpened: boolean;
  rootFolderName: string;
  rootFolderId: string;
  selectedFolderId?: string;
  initiallySelectedFolderId?: string;
  highlightTemporaryFolders?: boolean;
  showAllRootFolders?: boolean;
  onShowError?: (error: string) => void;
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
  showAllRootFolders,
  onShowError,
}: Props<T>) => {
  const highlightedFolders = useMemo(
    () => [selectedFolderId].filter(Boolean) as string[],
    [selectedFolderId],
  );

  const noFolders = !folderProps.allFolders.length;
  const isSearching = !!folderProps.searchTerm;

  return (
    <div className="flex min-h-[350px] flex-col" data-qa="select-folders">
      <CollapsibleSection
        onToggle={() => handleFolderSelect(rootFolderId)}
        name={rootFolderName}
        openByDefault
        dataQa="root-folder"
        isHighlighted={rootFolderId === selectedFolderId}
        togglerClassName={classNames(
          'mb-0.5 w-full rounded border-l-2 text-secondary',
          selectedFolderId === rootFolderId
            ? 'border-accent-primary bg-accent-primary-alpha'
            : 'border-transparent',
        )}
        className="!px-0"
      >
        {isAllEntitiesOpened && (
          <div className="flex grow flex-col gap-0.5">
            {!noFolders ? (
              <div className="flex flex-col gap-1" data-qa="all-folders">
                {folderProps.allFolders.map((folder) => {
                  if (
                    !showAllRootFolders &&
                    (folder.folderId !== rootFolderId ||
                      initiallySelectedFolderId)
                  ) {
                    return null;
                  }

                  if (showAllRootFolders && !isRootId(folder.folderId)) {
                    return null;
                  }

                  return (
                    <div className="relative" key={folder.id}>
                      <Folder
                        {...folderProps}
                        featureType={
                          isConversationId(folder.id)
                            ? FeatureType.Chat
                            : isFileId(folder.id)
                              ? FeatureType.File
                              : FeatureType.Prompt
                        }
                        skipFolderRenameValidation
                        maxDepth={MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH}
                        currentFolder={folder}
                        highlightedFolders={highlightedFolders}
                        highlightTemporaryFolders={highlightTemporaryFolders}
                        onShowError={onShowError}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="my-auto">
                {isSearching ? <NoResultsFound /> : <NoData />}
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
};
