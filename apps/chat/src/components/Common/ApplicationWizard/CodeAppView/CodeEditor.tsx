import { Editor } from '@monaco-editor/react';
import {
  IconArrowsMaximize,
  IconCheck,
  IconChevronDown,
  IconFile,
  IconFilePlus,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { UseFormSetValue } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { constructPath } from '@/src/utils/app/file';
import {
  getChildAndCurrentFoldersIdsById,
  getNextDefaultName,
} from '@/src/utils/app/folders';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { CODEAPPS_REQUIRED_FILES } from '@/src/constants/applications';

import SidebarActionButton from '../../../Buttons/SidebarActionButton';
import { FileItem } from '../../../Files/FileItem';
import { PreUploadDialog } from '../../../Files/PreUploadModal';
import Folder from '../../../Folder/Folder';
import { ConfirmDialog } from '../../ConfirmDialog';
import { Menu, MenuItem } from '../../DropdownMenu';
import Loader from '../../Loader';
import Tooltip from '../../Tooltip';
import { FormData } from '../form';
import { CodeAppExamples } from './CodeAppExamples';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import { UploadStatus } from '@epam/ai-dial-shared';

interface CodeEditorFile {
  file: DialFile;
  isHighlighted: boolean;
  level?: number;
  onSelectFile: (file: DialFile) => void;
  onDeleteFile: (fileId: string) => void;
}

const CodeEditorFile = ({
  file,
  onSelectFile,
  onDeleteFile,
  isHighlighted,
  level = 0,
}: CodeEditorFile) => {
  const handleDelete = useCallback(
    (_: unknown, fileId: string) => {
      onDeleteFile(fileId);
    },
    [onDeleteFile],
  );

  return (
    <button type="button" onClick={() => onSelectFile(file)} className="w-full">
      <FileItem
        iconClassNames="text-secondary"
        wrapperClassNames={classNames(
          'h-[30px] border-l-2',
          isHighlighted
            ? 'border-accent-primary bg-accent-primary-alpha'
            : 'border-transparent',
        )}
        onEvent={handleDelete}
        item={file}
        level={level}
      />
    </button>
  );
};

interface CodeEditorViewProps {
  isUploadingContent: boolean;
  selectedFile?: DialFile;
}

const CodeEditorView = ({
  isUploadingContent,
  selectedFile,
}: CodeEditorViewProps) => {
  const dispatch = useAppDispatch();

  const uploadedContent = useAppSelector(FilesSelectors.selectFileContent);
  const theme = useAppSelector(UISelectors.selectThemeState);

  const [fileContent, setFileContent] = useState<string>();

  useEffect(() => {
    setFileContent(uploadedContent);
  }, [uploadedContent]);

  if (isUploadingContent) {
    return <Loader />;
  }

  if (!fileContent) {
    return null;
  }

  return (
    <Editor
      options={{
        minimap: {
          enabled: false,
        },
        padding: {
          top: 12,
          bottom: 12,
        },
        scrollBeyondLastLine: false,
        scrollbar: {
          alwaysConsumeMouseWheel: false,
        },
      }}
      value={fileContent}
      language="python"
      onChange={setFileContent}
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      onMount={(editor) => {
        editor.onDidBlurEditorWidget(() => {
          const value = editor.getValue();

          if (selectedFile && value) {
            dispatch(
              FilesActions.updateFileContent({
                relativePath:
                  selectedFile.relativePath ??
                  getIdWithoutRootPathSegments(selectedFile.id),
                fileName: selectedFile.name,
                content: value,
                contentType: selectedFile.contentType,
              }),
            );
          }
        });
      }}
    />
  );
};

interface Props {
  sourcesFolderId: string | undefined;
  selectedRuntime: string;
  setValue: UseFormSetValue<FormData>;
}

export const CodeEditor = ({
  sourcesFolderId,
  selectedRuntime,
  setValue,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const loadingFolderIds = useAppSelector(
    FilesSelectors.selectLoadingFolderIds,
  );
  const isUploadingContent = useAppSelector(
    FilesSelectors.selectIsFileContentLoading,
  );
  const files = useAppSelector(FilesSelectors.selectFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );

  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<DialFile>();
  const [isVersionSelectorOpen, setIsVersionSelectorOpen] = useState(false);
  const [newFileFolder, setNewFileFolder] = useState<string>();
  const [newFileName, setNewFileName] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState<string>();
  const [deletingFileId, setDeletingFileId] = useState<string>();

  const { rootFiles, rootFolders } = useMemo(() => {
    if (sourcesFolderId) {
      return {
        rootFiles: files.filter((file) => file.folderId === sourcesFolderId),
        rootFolders: folders.filter(
          (folder) => folder.folderId === sourcesFolderId,
        ),
      };
    }

    return {
      rootFiles: [],
      rootFolders: [],
    };
  }, [files, folders, sourcesFolderId]);
  const rootFileNames = useMemo(
    () => rootFiles.map((f) => f.name),
    [rootFiles],
  );

  useEffect(() => {
    dispatch(FilesActions.resetFileTextContent());
    setSelectedFile(undefined);
  }, [dispatch, sourcesFolderId]);

  useEffect(() => {
    if (rootFiles.length && !selectedFile) {
      const appFile = rootFiles.find(
        (file) => file.name === CODEAPPS_REQUIRED_FILES.APP,
      );
      if (appFile) {
        setSelectedFile(appFile);
      } else {
        setSelectedFile(rootFiles[0]);
      }
    }
  }, [rootFiles, selectedFile]);

  useEffect(() => {
    if (selectedFile) {
      dispatch(FilesActions.getFileTextContent({ id: selectedFile.id }));
    }
  }, [dispatch, selectedFile]);

  useEffect(() => {
    if (sourcesFolderId) {
      setValue('sourceFiles', rootFileNames, { shouldValidate: true });
    }
  }, [rootFileNames, setValue, sourcesFolderId]);

  const handleUploadFile = useCallback(
    (relativePath: string) => {
      setUploadFolderId(relativePath);

      if (!openedFoldersIds.includes(relativePath)) {
        setOpenedFoldersIds(openedFoldersIds.concat(relativePath));
        dispatch(FilesActions.getFolders({ id: relativePath }));
      }
    },
    [dispatch, openedFoldersIds],
  );

  const handleUploadFiles = useCallback(
    (
      selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
      folderPath: string | undefined,
    ) => {
      selectedFiles.forEach((file) => {
        dispatch(
          FilesActions.uploadFile({
            fileContent: file.fileContent,
            id: file.id,
            relativePath: folderPath,
            name: file.name,
          }),
        );
      });
    },
    [dispatch],
  );

  const handleDeleteFile = useCallback(
    (confirmed: boolean) => {
      if (confirmed && deletingFileId) {
        dispatch(FilesActions.deleteFilesList({ fileIds: [deletingFileId] }));
      }

      setDeletingFileId(undefined);
    },
    [deletingFileId, dispatch],
  );

  const handleUploadEmptyFile = useCallback(() => {
    if (newFileName && sourcesFolderId) {
      dispatch(
        FilesActions.uploadFile({
          fileContent: new File([''], newFileName, {
            type: 'text/plain',
          }),
          relativePath: getIdWithoutRootPathSegments(sourcesFolderId),
          id: constructPath(sourcesFolderId, newFileName),
          name: newFileName,
        }),
      );
      setNewFileFolder(undefined);
      setNewFileName('');
    }
  }, [dispatch, newFileName, sourcesFolderId]);

  if (!sourcesFolderId) {
    return null;
  }

  return (
    <>
      <CodeAppExamples fileNames={rootFileNames} folderId={sourcesFolderId} />
      <div className="mt-3 grid h-[400px] min-h-[400px] w-full max-w-full grid-cols-[minmax(0,1fr)_2fr] gap-1">
        <div className="flex max-h-[400px] flex-col gap-0.5 divide-y divide-tertiary rounded border border-tertiary bg-layer-3">
          <div className="grow overflow-y-auto p-3">
            {rootFolders.map((folder) => {
              return (
                <Folder
                  key={folder.id}
                  searchTerm={''}
                  onFileUpload={handleUploadFile}
                  currentFolder={folder}
                  allFolders={folders}
                  isInitialRenameEnabled
                  loadingFolderIds={loadingFolderIds}
                  openedFoldersIds={openedFoldersIds}
                  allItems={files}
                  onAddFolder={(parentId) =>
                    dispatch(FilesActions.addNewFolder({ parentId }))
                  }
                  itemComponent={(props) => (
                    <CodeEditorFile
                      level={props.level}
                      file={props.item as DialFile}
                      onSelectFile={setSelectedFile}
                      isHighlighted={selectedFile?.id === props.item.id}
                      onDeleteFile={setDeletingFileId}
                    />
                  )}
                  onClickFolder={(folderId) => {
                    if (openedFoldersIds.includes(folderId)) {
                      const childFoldersIds = getChildAndCurrentFoldersIdsById(
                        folderId,
                        folders,
                      );
                      setOpenedFoldersIds(
                        openedFoldersIds.filter(
                          (id) => !childFoldersIds.includes(id),
                        ),
                      );
                    } else {
                      setOpenedFoldersIds(openedFoldersIds.concat(folderId));
                      const folder = folders.find((f) => f.id === folderId);
                      if (folder?.status !== UploadStatus.LOADED) {
                        dispatch(
                          FilesActions.getFilesWithFolders({ id: folderId }),
                        );
                      }
                    }
                  }}
                  withBorderHighlight={false}
                  featureType={FeatureType.File}
                />
              );
            })}
            {rootFiles.map((file) => (
              <CodeEditorFile
                key={file.id}
                file={file}
                onSelectFile={setSelectedFile}
                isHighlighted={selectedFile?.id === file.id}
                onDeleteFile={setDeletingFileId}
              />
            ))}
            {newFileFolder && (
              <div
                className="relative flex h-[30px] w-full items-center gap-2 rounded border-l-2 border-accent-primary bg-accent-primary-alpha px-3"
                data-qa="edit-container"
              >
                <IconFile className="text-secondary" size={18} />
                <input
                  className="w-full flex-1 overflow-hidden text-ellipsis bg-transparent text-left outline-none"
                  type="text"
                  value={newFileName}
                  name="edit-input"
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={handleUploadEmptyFile}
                  autoFocus
                />
                <div className="absolute right-1 z-10 flex" data-qa="actions">
                  <SidebarActionButton
                    handleClick={handleUploadEmptyFile}
                    dataQA="confirm-edit"
                  >
                    <IconCheck
                      size={18}
                      className="hover:text-accent-primary"
                    />
                  </SidebarActionButton>
                  <SidebarActionButton
                    handleClick={() => {
                      setNewFileFolder(undefined);
                      setNewFileName('');
                    }}
                    dataQA="cancel-edit"
                  >
                    <IconX
                      size={18}
                      strokeWidth="2"
                      className="hover:text-accent-primary"
                    />
                  </SidebarActionButton>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Tooltip tooltip={t('Create file')}>
              <button
                type="button"
                onClick={() => {
                  setNewFileFolder(sourcesFolderId);
                  setNewFileName(getNextDefaultName('New file', rootFiles));
                }}
                className="text-secondary hover:text-accent-primary"
              >
                <IconFilePlus size={18} />
              </button>
            </Tooltip>
            <Tooltip tooltip={t('Upload file')}>
              <button
                type="button"
                onClick={() => setUploadFolderId(sourcesFolderId)}
                className="text-secondary hover:text-accent-primary"
              >
                <IconUpload size={18} />
              </button>
            </Tooltip>
            <Tooltip tooltip={t('Add new folder')}>
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    FilesActions.addNewFolder({ parentId: sourcesFolderId }),
                  )
                }
                className="text-secondary hover:text-accent-primary"
              >
                <FolderPlus height={18} width={18} />
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="flex max-h-[400px] w-full flex-col divide-y divide-tertiary rounded border border-tertiary bg-layer-3">
          <div className="flex w-full justify-end gap-3 divide-x divide-tertiary">
            <Menu
              onOpenChange={setIsVersionSelectorOpen}
              disabled={false}
              className="relative flex w-[112px] cursor-pointer justify-center py-2"
              trigger={
                <div className="flex items-center justify-center gap-1">
                  {selectedRuntime}
                  <IconChevronDown
                    className={classNames(
                      'absolute right-0.5 top-1/2 shrink-0 -translate-y-1/2 transition-all',
                      isVersionSelectorOpen && 'rotate-180',
                    )}
                    size={18}
                  />
                </div>
              }
            >
              {pythonVersions.map((version) => {
                if (version === selectedRuntime) return null;
                return (
                  <MenuItem
                    onClick={() => setValue('runtime', version)}
                    className="flex justify-center hover:bg-accent-primary-alpha"
                    key={version}
                    item={version}
                  />
                );
              })}
            </Menu>
            <Tooltip tooltip={t('Full screen')}>
              <button
                type="button"
                className="px-3 text-secondary hover:text-accent-primary"
              >
                <IconArrowsMaximize size={18} />
              </button>
            </Tooltip>
          </div>
          <div className="grow p-3">
            <CodeEditorView
              isUploadingContent={isUploadingContent}
              selectedFile={selectedFile}
            />
          </div>
        </div>
        {uploadFolderId && (
          <PreUploadDialog
            uploadFolderId={uploadFolderId}
            isOpen
            allowedTypes={['*/*']}
            initialFilesSelect
            onUploadFiles={handleUploadFiles}
            onClose={() => setUploadFolderId(undefined)}
            maximumAttachmentsAmount={Number.MAX_SAFE_INTEGER}
          />
        )}
        <ConfirmDialog
          isOpen={!!deletingFileId}
          heading={t('Confirm deleting')}
          description={
            t('Are you sure that you want to delete {{name}}', {
              name: deletingFileId?.split('/').pop(),
            }) || ''
          }
          confirmLabel={t('Confirm')}
          cancelLabel={t('Cancel')}
          onClose={handleDeleteFile}
        />
      </div>
    </>
  );
};
