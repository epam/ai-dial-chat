import { useSectionToggle } from '@/src/hooks/useSectionToggle';

import { isRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { EntityFilters } from '@/src/types/search';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppSelector } from '@/src/store/hooks';

import CollapsibleSection from '../Common/CollapsibleSection';
import { NoData } from '../Common/NoData';
import { NoResultsFound } from '../Common/NoResultsFound';
import Folder from '../Folder/Folder';
import { FileItem } from './FileItem';

interface Props {
  name: string;
  filters: EntityFilters;
  dataQa: string;
  searchQuery: string;
  openedFoldersIds: string[];
  highlightFolderIds: string[];
  openByDefault: boolean;
  selectedFilesIds?: string[];
  selectedFolderIds?: string[];
  showTooltip?: boolean;
  forceShowSelectCheckBox?: boolean;
  forceHideSelectFolders?: boolean;
  handleFolderSelect?: (id: string) => void;
  handleAddFolder?: (id: string) => void;
  handleRenameFolder?: (name: string, id: string) => void;
  handleUploadFile?: (id: string) => void;
  handleItemCallback?: (id: string, data: unknown) => void;
  handleFolderToggle?: (id: string, isSelected: boolean) => void;
}

export const FileSection = ({
  name,
  filters,
  dataQa,
  searchQuery,
  openedFoldersIds,
  openByDefault,
  highlightFolderIds,
  selectedFilesIds,
  selectedFolderIds,
  forceShowSelectCheckBox,
  showTooltip,
  forceHideSelectFolders,
  handleFolderSelect,
  handleAddFolder,
  handleRenameFolder,
  handleUploadFile,
  handleItemCallback,
  handleFolderToggle,
}: Props) => {
  const rootFolders = useAppSelector((state) =>
    FilesSelectors.selectFilteredFolders(state, filters, searchQuery),
  );
  const newFolderId = useAppSelector(FilesSelectors.selectNewAddedFolderId);
  const rootFiles = useAppSelector((state) =>
    FilesSelectors.selectFilteredFiles(state, filters, searchQuery),
  );
  const allFiles = useAppSelector(FilesSelectors.selectFiles);
  const allFolders = useAppSelector(FilesSelectors.selectFolders);
  const loadingFolderIds = useAppSelector(
    FilesSelectors.selectLoadingFolderIds,
  );
  const canAttachFolders =
    useAppSelector(ConversationsSelectors.selectCanAttachFolders) &&
    !forceHideSelectFolders;
  const canAttachFiles = useAppSelector(
    ConversationsSelectors.selectCanAttachFile,
  );

  const { handleToggle, isExpanded } = useSectionToggle(name, FeatureType.File);

  const isNoEntitiesFound =
    rootFolders.every(
      (folder) =>
        !folder.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ) &&
    rootFiles.every(
      (file) => !file.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  return (
    <CollapsibleSection
      onToggle={handleToggle}
      name={name}
      openByDefault={openByDefault ?? isExpanded}
      dataQa={dataQa}
    >
      <div
        className="flex min-h-[350px] flex-col overflow-auto"
        data-qa="all-files"
      >
        <div className="flex grow flex-col gap-0.5 overflow-auto">
          {searchQuery !== '' && isNoEntitiesFound ? (
            <div className="my-auto">
              <NoResultsFound />
            </div>
          ) : rootFolders.length === 0 && rootFiles.length === 0 ? (
            <div className="my-auto">
              <NoData />
            </div>
          ) : (
            <div className="flex flex-col gap-1 overflow-auto">
              {rootFolders.map((folder) => {
                if (!isRootId(folder.folderId)) {
                  return null;
                }
                return (
                  <div key={folder.id}>
                    <Folder
                      searchTerm={searchQuery}
                      currentFolder={folder}
                      allFolders={allFolders}
                      highlightedFolders={highlightFolderIds}
                      isInitialRenameEnabled
                      newAddedFolderId={newFolderId}
                      loadingFolderIds={loadingFolderIds}
                      openedFoldersIds={openedFoldersIds}
                      allItems={allFiles}
                      additionalItemData={{
                        selectedFilesIds,
                        selectedFolderIds,
                        canAttachFiles:
                          canAttachFiles || forceShowSelectCheckBox,
                      }}
                      itemComponent={FileItem}
                      onClickFolder={handleFolderSelect}
                      onAddFolder={handleAddFolder}
                      onFileUpload={handleUploadFile}
                      onRenameFolder={handleRenameFolder}
                      skipFolderRenameValidation
                      onItemEvent={handleItemCallback}
                      withBorderHighlight={false}
                      featureType={FeatureType.File}
                      canSelectFolders={canAttachFolders}
                      showTooltip={showTooltip}
                      onSelectFolder={handleFolderToggle}
                    />
                  </div>
                );
              })}
              {rootFiles.map((file) => {
                if (!isRootId(file.folderId)) {
                  return null;
                }
                return (
                  <div key={file.id}>
                    <FileItem
                      item={file}
                      level={0}
                      additionalItemData={{
                        selectedFolderIds,
                        selectedFilesIds,
                        canAttachFiles: canAttachFiles,
                      }}
                      onEvent={handleItemCallback}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
};
