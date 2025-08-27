import { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { getParentAndChildFolders } from '@/src/utils/app/folders';
import { isConversationId, isFileId, isRootId } from '@/src/utils/app/id';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';

import { Conversation } from '@/src/types/chat';
import { AdditionalItemData, FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';

import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';
import { NoData } from '@/src/components/Common/NoData';
import { NoResultsFound } from '@/src/components/Common/NoResultsFound';
import { Folder, FolderProps } from '@/src/components/Folder/Folder';

interface Props<T, P = unknown>
  extends Omit<FolderProps<T, P>, 'currentFolder' | 'featureType'> {
  isAllEntitiesOpened: boolean;
  rootFolderName: string;
  rootFolderId: string;
  searchTerm: string;
  allFolders: FolderInterface[];
  isInitialRenameEnabled: boolean;
  openedFoldersIds: string[];
  loadingFolderIds?: string[];
  additionalItemData?: AdditionalItemData;
  selectedFolderId?: string;
  initiallySelectedFolderId?: string;
  highlightTemporaryFolders?: boolean;
  showAllRootFolders?: boolean;
  newAddedFolderId?: string;
  editOnlyTemporary?: boolean;
  deleteOnlyTemporary?: boolean;
  disableSectionToggle?: boolean;
  onClickFolder: (folderId: string) => void;
  onRenameFolder: (newName: string, folderId: string) => void;
  onAddFolder: (parentFolderId: string) => void;
  onFolderSelect: (folderId: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onShowError?: (error: string) => void;
}

export const SelectFolderList = <T extends Conversation | Prompt | DialFile>({
  isAllEntitiesOpened,
  allFolders,
  searchTerm,
  selectedFolderId,
  initiallySelectedFolderId,
  highlightTemporaryFolders,
  rootFolderName,
  rootFolderId,
  showAllRootFolders,
  disableSectionToggle,
  onFolderSelect,
  onRenameFolder,
  onDeleteFolder,
  onShowError,
  ...props
}: Props<T>) => {
  const highlightedFolders = useMemo(
    () => [selectedFolderId].filter(Boolean) as string[],
    [selectedFolderId],
  );

  const handleToggleSection = useCallback(() => {
    onFolderSelect(rootFolderId);
  }, [onFolderSelect, rootFolderId]);

  const filteredFolders = useMemo(() => {
    const filteredFolders = allFolders.filter((folder) =>
      doesEntityContainSearchTerm(folder, searchTerm),
    );

    return getParentAndChildFolders(allFolders, filteredFolders);
  }, [allFolders, searchTerm]);

  const noFolders = !filteredFolders.length;
  const isSearching = !!searchTerm;

  return (
    <div
      className="flex min-h-[350px] flex-col overflow-auto"
      data-qa="select-folders"
    >
      <CollapsibleSection
        onToggle={handleToggleSection}
        name={rootFolderName}
        isExpanded={disableSectionToggle}
        openByDefault
        dataQa="root-folder"
        isHighlighted={rootFolderId === selectedFolderId}
        togglerClassName={classNames(
          'mb-0.5 w-full rounded border-l-2 text-secondary',
          selectedFolderId === rootFolderId
            ? 'border-accent-primary bg-accent-primary-alpha'
            : 'border-transparent',
        )}
        className="grow !px-0"
      >
        {isAllEntitiesOpened && (
          <div className="flex grow flex-col gap-0.5">
            {!noFolders ? (
              <div className="flex flex-col gap-1" data-qa="all-folders">
                {filteredFolders.map((folder) => {
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
                        {...props}
                        searchTerm={searchTerm}
                        allFolders={allFolders}
                        onRenameFolder={onRenameFolder}
                        onDeleteFolder={onDeleteFolder}
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
