import { Editor } from '@monaco-editor/react';
import {
  IconCheck,
  IconFile,
  IconFilePlus,
  IconTrashX,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { UseFormSetValue } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { constructPath } from '@/src/utils/app/file';
import {
  getChildAndCurrentFoldersIdsById,
  getNextDefaultName,
} from '@/src/utils/app/folders';
import {
  getFileRootId,
  getIdWithoutRootPathSegments,
} from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { CODEAPPS_REQUIRED_FILES } from '@/src/constants/applications';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import { FileItem } from '@/src/components/Files/FileItem';
import { PreUploadDialog } from '@/src/components/Files/PreUploadModal';
import { SelectFolderModal } from '@/src/components/Files/SelectFolderModal';
import Folder from '@/src/components/Folder/Folder';

import { ConfirmDialog } from '../../ConfirmDialog';
import { FieldErrorMessage } from '../../Forms/FieldErrorMessage';
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

interface CodeEditorProps {
  sourcesFolderId: string | undefined;
  setValue: UseFormSetValue<FormData>;
}

const CodeEditor = ({ sourcesFolderId, setValue }: CodeEditorProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const theme = useAppSelector(UISelectors.selectThemeState);
  const uploadedContent = useAppSelector(FilesSelectors.selectFileContent);
  const loadingFolderIds = useAppSelector(
    FilesSelectors.selectLoadingFolderIds,
  );
  const isUploadingContent = useAppSelector(
    FilesSelectors.selectIsFileContentLoading,
  );
  const files = useAppSelector(FilesSelectors.selectFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);

  const [fileContent, setFileContent] = useState<string>();
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<DialFile>();
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
    setSelectedFile(undefined);
  }, [sourcesFolderId]);

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
    if (typeof uploadedContent === 'string') {
      setFileContent(uploadedContent);
    }
  }, [uploadedContent]);

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

  const handleDeleteFile = useCallback(() => {
    if (deletingFileId) {
      dispatch(FilesActions.deleteFilesList({ fileIds: [deletingFileId] }));
      setDeletingFileId(undefined);
    }
  }, [deletingFileId, dispatch]);

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
      <div className="mt-3 grid h-[400px] w-full max-w-full grid-cols-[minmax(0,1fr)_2fr] gap-1">
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
        <div className="max-h-[400px] w-full rounded border border-tertiary bg-layer-3 p-3">
          {isUploadingContent ? (
            <Loader />
          ) : (
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
          )}
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
          onClose={handleDeleteFile}
        />
      </div>
    </>
  );
};

interface SourceFilesEditorProps {
  value?: string;
  onChange?: (v: string) => void;
  error?: string;
  setValue: UseFormSetValue<FormData>;
}

const _SourceFilesEditor: FC<SourceFilesEditorProps> = ({
  value,
  onChange,
  error,
  setValue,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  const handleToggleFileManager = useCallback(() => {
    setIsFolderModalOpen((p) => !p);
  }, [setIsFolderModalOpen]);

  const handleCloseFileManager = useCallback(
    (folder?: string) => {
      if (folder) {
        onChange?.(folder);
      }
      setIsFolderModalOpen(false);
    },
    [onChange],
  );

  useEffect(() => {
    if (value) {
      dispatch(FilesActions.getFilesWithFolders({ id: value }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button
        className="input-form button mx-0 flex grow cursor-default items-center border-primary px-3 py-2"
        data-qa="change-source-files-path-container"
        type="button"
      >
        <div className="flex w-full justify-between truncate whitespace-pre break-all">
          <Tooltip
            tooltip={getIdWithoutRootPathSegments(value ?? '')}
            contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
            triggerClassName={classNames(
              'truncate whitespace-pre',
              !value && 'text-secondary',
            )}
            hideTooltip={!value}
            dataQa="path"
          >
            {value ? getIdWithoutRootPathSegments(value) : t('No folder')}
          </Tooltip>
          <div className="flex items-center gap-3">
            <span
              className="h-full cursor-pointer text-accent-primary"
              data-qa="change-button"
              onClick={handleToggleFileManager}
            >
              {t('Change')}
            </span>
            <button
              onClick={() => {
                onChange?.('');
              }}
              type="button"
              className="text-secondary hover:text-accent-primary"
            >
              <IconTrashX size={18} />
            </button>
          </div>
        </div>
      </button>

      <FieldErrorMessage error={error} className="mt-1" />

      <CodeEditor sourcesFolderId={value} setValue={setValue} />

      <SelectFolderModal
        isOpen={isFolderModalOpen}
        initialSelectedFolderId={getFileRootId()}
        rootFolderId={getFileRootId()}
        onClose={handleCloseFileManager}
      />
    </>
  );
};

export const SourceFilesEditor = memo(_SourceFilesEditor);
