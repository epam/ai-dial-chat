import { IconCheck, IconFile } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { truncateToUtf8Bytes } from '@/src/utils/app/common';
import { notAllowedSymbolsRegex } from '@/src/utils/app/file';
import {
  getChildAndCurrentFoldersIdsById,
  getNextDefaultName,
} from '@/src/utils/app/folders';
import { getResourceMaxSegmentBytes } from '@/src/utils/app/resource-limits';
import { isHiddenEntity } from '@/src/utils/app/search';

import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';

import { CodeEditorActions, FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { CodeEditorSelectors, FilesSelectors } from '@/src/store/selectors';

import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';

import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';
import { Loader } from '@/src/components/Common/Loader';
import { Folder } from '@/src/components/Folder/Folder';

import { CodeEditorFile } from './CodeEditorFile';
import { CodeEditorFileTreeEmptyState } from './CodeEditorFileTreeEmptyState';

import { UploadStatus } from '@epam/ai-dial-shared';
import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';

interface CodeEditorFileTreeProps {
  sourcesFolderId: string;
  readOnly?: boolean;
  newFileFolder: string | undefined;
  newFileName: string;
  onNewFileNameChange: (name: string) => void;
  onConfirmNewFile: (name: string) => void;
  onCreateFile: () => void;
  onDeleteFile: (id: string) => void;
  onSaveFiles: (ids: string[]) => void;
  onFileUpload: (folderId: string) => void;
}

export const CodeEditorFileTree = ({
  sourcesFolderId,
  readOnly,
  newFileFolder,
  newFileName,
  onNewFileNameChange,
  onConfirmNewFile,
  onCreateFile,
  onDeleteFile,
  onSaveFiles,
  onFileUpload,
}: CodeEditorFileTreeProps) => {
  const dispatch = useAppDispatch();

  const isFilesLoading = useAppSelector(FilesSelectors.selectAreFilesLoading);
  const allFiles = useAppSelector(FilesSelectors.selectFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const loadingFolderIds = useAppSelector(
    FilesSelectors.selectLoadingFolderIds,
  );
  const modifiedFileIds = useAppSelector(
    CodeEditorSelectors.selectModifiedFileIds,
  );
  const selectedFileId = useAppSelector(CodeEditorSelectors.selectSelectedFile);

  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);

  const files = useMemo(
    () => allFiles.filter((file) => !isHiddenEntity(file)),
    [allFiles],
  );

  const { rootFiles, rootFolders } = useMemo(
    () => ({
      rootFiles: files.filter((file) => file.folderId === sourcesFolderId),
      rootFolders: folders.filter(
        (folder) => folder.folderId === sourcesFolderId,
      ),
    }),
    [files, folders, sourcesFolderId],
  );

  const handleToggleFolder = useCallback(
    (folderId: string) => {
      if (openedFoldersIds.includes(folderId)) {
        const childFoldersIds = getChildAndCurrentFoldersIdsById(
          folderId,
          folders,
        );
        setOpenedFoldersIds(
          openedFoldersIds.filter((id) => !childFoldersIds.includes(id)),
        );
      } else {
        setOpenedFoldersIds(openedFoldersIds.concat(folderId));
        const folder = folders.find((f) => f.id === folderId);
        if (folder?.status !== UploadStatus.LOADED) {
          dispatch(FilesActions.getFilesWithFolders({ id: folderId }));
        }
      }
    },
    [dispatch, folders, openedFoldersIds],
  );

  const handleAddFolder = useCallback(
    (folderId: string) => {
      dispatch(FilesActions.addNewFolder({ parentId: folderId }));
      if (!openedFoldersIds.includes(folderId)) handleToggleFolder(folderId);
    },
    [dispatch, handleToggleFolder, openedFoldersIds],
  );

  const handleSelectFile = useCallback(
    (file: DialFile) => {
      dispatch(CodeEditorActions.setSelectedFileId(file.id));
    },
    [dispatch],
  );

  const handleFileUpload = useCallback(
    (relativePath: string) => {
      onFileUpload(relativePath);
      if (!openedFoldersIds.includes(relativePath)) {
        setOpenedFoldersIds((prev) => prev.concat(relativePath));
        dispatch(FilesActions.getFolders({ id: relativePath }));
      }
    },
    [dispatch, onFileUpload, openedFoldersIds],
  );

  if (
    !rootFiles.length &&
    !rootFolders.length &&
    !isFilesLoading &&
    !newFileName
  ) {
    return <CodeEditorFileTreeEmptyState onCreateFile={onCreateFile} />;
  }

  if (!rootFiles.length && !rootFolders.length && isFilesLoading) {
    return <Loader />;
  }

  return (
    <>
      {rootFolders.map((folder) => (
        <Folder
          maxDepth={MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH}
          key={folder.id}
          searchTerm=""
          onFileUpload={handleFileUpload}
          currentFolder={folder}
          allFolders={folders}
          isInitialRenameEnabled
          loadingFolderIds={loadingFolderIds}
          openedFoldersIds={openedFoldersIds}
          allItems={files}
          onAddFolder={handleAddFolder}
          itemComponent={(props) => (
            <CodeEditorFile
              isModified={modifiedFileIds.includes(props.item.id)}
              level={props.level}
              file={props.item}
              readOnly={readOnly}
              onSelectFile={handleSelectFile}
              isHighlighted={selectedFileId === props.item.id}
              onDeleteFile={onDeleteFile}
              onSave={onSaveFiles}
            />
          )}
          onClickFolder={handleToggleFolder}
          withBorderHighlight={false}
          featureType={FeatureType.File}
        />
      ))}
      {rootFiles.map((file) => (
        <CodeEditorFile
          isModified={modifiedFileIds.includes(file.id)}
          key={file.id}
          file={file}
          readOnly={readOnly}
          onSelectFile={handleSelectFile}
          isHighlighted={selectedFileId === file.id}
          onDeleteFile={onDeleteFile}
          onSave={onSaveFiles}
        />
      ))}
      {newFileFolder && (
        <div
          className="relative flex h-[30px] w-full items-center gap-2 rounded border-l-2 border-accent-primary bg-accent-primary-alpha px-3"
          data-qa="edit-container"
        >
          <IconFile className="text-secondary" size={18} />
          <input
            className="me-12 w-full flex-1 overflow-hidden text-ellipsis bg-transparent text-start outline-none"
            type="text"
            value={newFileName}
            name="edit-input"
            onChange={(e) =>
              onNewFileNameChange(
                truncateToUtf8Bytes(
                  e.target.value.replaceAll(notAllowedSymbolsRegex, ''),
                  getResourceMaxSegmentBytes(),
                ),
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onConfirmNewFile(newFileName);
              }
            }}
            autoFocus
          />
          <div className="absolute right-1 z-10 flex gap-x-1" data-qa="actions">
            <DialGhostIconButton
              data-qa="confirm-edit"
              onClick={() => onConfirmNewFile(newFileName)}
              size={ElementSize.Small}
              icon={<IconCheck size={18} />}
            />
            <CloseButtonSmall
              onClick={() =>
                onConfirmNewFile(getNextDefaultName('New file', rootFiles))
              }
              data-qa="cancel-edit"
            />
          </div>
        </div>
      )}
    </>
  );
};
