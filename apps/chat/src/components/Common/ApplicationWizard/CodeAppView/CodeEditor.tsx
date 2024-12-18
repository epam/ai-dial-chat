import { Editor } from '@monaco-editor/react';
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCheck,
  IconDeviceFloppy,
  IconFile,
  IconFilePlus,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';

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

import {
  CodeEditorActions,
  CodeEditorSelectors,
} from '@/src/store/codeEditor/codeEditor.reducer';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';

import SidebarActionButton from '@/src/components/Buttons/SidebarActionButton';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import Loader from '@/src/components/Common/Loader';
import Tooltip from '@/src/components/Common/Tooltip';
import { FileItem } from '@/src/components/Files/FileItem';
import { PreUploadDialog } from '@/src/components/Files/PreUploadModal';
import Folder from '@/src/components/Folder/Folder';

import { CodeData } from '../form';
import { CodeAppExamples } from './CodeAppExamples';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import { UploadStatus } from '@epam/ai-dial-shared';
import debounce, { DebouncedFunc } from 'lodash-es/debounce';
import * as monaco from 'monaco-editor';

interface CodeEditorFile {
  file: DialFile;
  isHighlighted: boolean;
  level?: number;
  isModified: boolean;
  onSelectFile: (file: DialFile) => void;
  onDeleteFile: (fileId: string) => void;
  onSave: (fileIds: string[]) => void;
}

const CodeEditorFile = ({
  file,
  isHighlighted,
  isModified,
  level = 0,
  onSelectFile,
  onDeleteFile,
  onSave,
}: CodeEditorFile) => {
  const handleDelete = useCallback(
    (_: unknown, fileId: string) => {
      onDeleteFile(fileId);
    },
    [onDeleteFile],
  );

  const handleSave = useCallback(
    (fileId: string) => {
      onSave([fileId]);
    },
    [onSave],
  );

  return (
    <div onClick={() => onSelectFile(file)} className="w-full cursor-pointer">
      <FileItem
        iconClassNames="text-secondary"
        wrapperClassNames={classNames(
          'h-[30px] border-l-2',
          isHighlighted
            ? 'border-accent-primary bg-accent-primary-alpha'
            : 'border-transparent',
          isModified && '!text-warning',
        )}
        onEvent={handleDelete}
        onSave={isModified ? handleSave : undefined}
        item={file}
        level={level}
      />
    </div>
  );
};

interface CodeEditorViewProps {
  selectedFileId: string;
}

const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
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
  automaticLayout: true,
};

const CodeEditorView = ({ selectedFileId }: CodeEditorViewProps) => {
  const dispatch = useAppDispatch();
  const selectFileContentSelector = useMemo(
    () => CodeEditorSelectors.selectFileContent(selectedFileId),
    [selectedFileId],
  );
  const fileContent = useAppSelector(selectFileContentSelector);
  const isContentLoading = useAppSelector(
    CodeEditorSelectors.selectIsFileContentLoading,
  );
  const theme = useAppSelector(UISelectors.selectThemeState);

  const debouncedChangeHandlerRef = useRef<DebouncedFunc<
    (content: string) => void
  > | null>(null);
  const fileContentRef = useRef<typeof fileContent>();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const modelCacheRef = useRef<
    Record<string, monaco.editor.ITextModel | undefined>
  >({});
  const contentRef = useRef<string | null>(null);

  const [isEditorReady, setIsEditorReady] = useState(false);

  useEffect(() => {
    debouncedChangeHandlerRef.current = debounce((content: string) => {
      if (typeof content === 'string') {
        dispatch(
          CodeEditorActions.modifyFileContent({
            fileId: selectedFileId,
            content,
          }),
        );
      }
    }, 300);

    return () => {
      debouncedChangeHandlerRef.current?.cancel();
    };
  }, [dispatch, selectedFileId]);

  useEffect(() => {
    fileContentRef.current = fileContent;
  }, [fileContent]);

  useEffect(() => {
    if (fileContent) {
      contentRef.current = fileContent.modifiedContent ?? fileContent.content;
    }
  }, [fileContent]);

  useEffect(() => {
    if (
      isEditorReady &&
      monacoRef.current &&
      editorRef.current &&
      typeof contentRef.current === 'string' &&
      !isContentLoading
    ) {
      if (
        !modelCacheRef.current[selectedFileId] ||
        modelCacheRef.current[selectedFileId]?.isDisposed()
      ) {
        modelCacheRef.current[selectedFileId] =
          monacoRef.current.editor.createModel(
            contentRef.current,
            'python',
            monacoRef.current.Uri.file(selectedFileId),
          );
      }

      editorRef.current.setModel(modelCacheRef.current[selectedFileId]!);
    }
  }, [selectedFileId, isEditorReady, isContentLoading]);

  const handleDebouncedChange = useCallback((content: string | undefined) => {
    if (typeof content === 'string' && debouncedChangeHandlerRef.current) {
      debouncedChangeHandlerRef.current(content);
    }
  }, []);

  const handleBeforeEditorMount = useCallback(() => {
    setIsEditorReady(false);
  }, []);

  const handleEditorMount = useCallback(
    (
      codeEditor: monaco.editor.IStandaloneCodeEditor,
      editorMonaco: typeof monaco,
    ) => {
      editorRef.current = codeEditor;
      monacoRef.current = editorMonaco;

      monacoRef.current.editor.getModels().forEach((model) => model.dispose());

      // use refs inside codeEditor handlers to get actual values
      codeEditor.onKeyDown((e) => {
        if (e.keyCode === 49 && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();

          const value = codeEditor.getValue();
          const currentContent = fileContentRef.current;

          if (
            typeof value === 'string' &&
            currentContent &&
            currentContent.modified
          ) {
            dispatch(
              CodeEditorActions.updateFileContent({
                id: currentContent.id,
                content: value,
              }),
            );
          }
        }
      });

      setIsEditorReady(true);
    },
    [dispatch],
  );

  if (isContentLoading) {
    return <Loader />;
  }

  if (fileContent === undefined) {
    return null;
  }

  return (
    <Editor
      options={editorOptions}
      language="python"
      onChange={handleDebouncedChange}
      theme={theme === 'dark' ? 'vs-dark' : 'vs'}
      onMount={handleEditorMount}
      beforeMount={handleBeforeEditorMount}
    />
  );
};

interface Props {
  sourcesFolderId: string | undefined;
}

export const CodeEditor = ({ sourcesFolderId }: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const { setValue } = useFormContext<CodeData>();

  const dispatch = useAppDispatch();

  const loadingFolderIds = useAppSelector(
    FilesSelectors.selectLoadingFolderIds,
  );
  const files = useAppSelector(FilesSelectors.selectFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const selectedFileId = useAppSelector(CodeEditorSelectors.selectSelectedFile);
  const modifiedFileIds = useAppSelector(
    CodeEditorSelectors.selectModifiedFileIds,
  );
  const filesContent = useAppSelector(CodeEditorSelectors.selectFilesContent);

  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [newFileFolder, setNewFileFolder] = useState<string>();
  const [newFileName, setNewFileName] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState<string>();
  const [deletingFileId, setDeletingFileId] = useState<string>();
  const [isFullScreen, setIsFullScreen] = useState(false);

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
    if (sourcesFolderId) {
      dispatch(CodeEditorActions.initCodeEditor({ sourcesFolderId }));
    }
  }, [dispatch, sourcesFolderId]);

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
      if (confirmed && deletingFileId && sourcesFolderId) {
        dispatch(
          CodeEditorActions.deleteFile({ id: deletingFileId, sourcesFolderId }),
        );
      }

      setDeletingFileId(undefined);
    },
    [deletingFileId, dispatch, sourcesFolderId],
  );

  const handleSaveFiles = useCallback(
    (fileIds: string[]) => {
      fileIds.forEach((id) => {
        const foundFile = filesContent.find((file) => file.id === id);

        if (foundFile && foundFile.modified) {
          dispatch(
            CodeEditorActions.updateFileContent({
              id,
              content: foundFile.modifiedContent ?? foundFile.content,
            }),
          );
        }
      });
    },
    [dispatch, filesContent],
  );

  const handleUploadEmptyFile = useCallback(
    (fileName: string) => {
      if (fileName && sourcesFolderId) {
        dispatch(
          FilesActions.uploadFile({
            fileContent: new File([''], fileName, {
              type: 'text/plain',
            }),
            relativePath: getIdWithoutRootPathSegments(sourcesFolderId),
            id: constructPath(sourcesFolderId, fileName),
            name: fileName,
          }),
        );
        setNewFileFolder(undefined);
        setNewFileName('');
      }
    },
    [dispatch, sourcesFolderId],
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
        } else {
          setOpenedFoldersIds(openedFoldersIds.concat(folderId));
          const folder = folders.find((f) => f.id === folderId);
          if (folder?.status !== UploadStatus.LOADED) {
            dispatch(
              FilesActions.getFilesWithFolders({
                id: folderId,
              }),
            );
          }
        }
      }
    },
    [openedFoldersIds, setOpenedFoldersIds, folders, dispatch],
  );

  const handleAddFolder = useCallback(
    (folderId: string) => {
      dispatch(FilesActions.addNewFolder({ parentId: folderId }));
      if (!openedFoldersIds.includes(folderId)) handleToggleFolder(folderId);
    },
    [dispatch, handleToggleFolder, openedFoldersIds],
  );

  const FullScreenIcon = useMemo(
    () => (isFullScreen ? IconArrowsMinimize : IconArrowsMaximize),
    [isFullScreen],
  );

  if (!sourcesFolderId) {
    return null;
  }

  return (
    <>
      <CodeAppExamples fileNames={rootFileNames} folderId={sourcesFolderId} />
      <div className="z-10">
        <div
          className={classNames(
            'flex min-h-[400px] w-full max-w-full',
            isFullScreen ? 'fixed inset-0 z-50' : 'h-[400px]',
          )}
        >
          <div className="flex max-h-full min-w-0 shrink flex-col gap-0.5 divide-y divide-tertiary rounded border border-tertiary bg-layer-3">
            <div className="w-[220px] min-w-0 shrink grow overflow-y-auto p-3">
              {rootFolders.map((folder) => {
                return (
                  <Folder
                    maxDepth={MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH}
                    key={folder.id}
                    searchTerm={''}
                    onFileUpload={handleUploadFile}
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
                        file={props.item as DialFile}
                        onSelectFile={(file) =>
                          dispatch(CodeEditorActions.setSelectedFileId(file.id))
                        }
                        isHighlighted={selectedFileId === props.item.id}
                        onDeleteFile={setDeletingFileId}
                        onSave={handleSaveFiles}
                      />
                    )}
                    onClickFolder={handleToggleFolder}
                    withBorderHighlight={false}
                    featureType={FeatureType.File}
                  />
                );
              })}
              {rootFiles.map((file) => (
                <CodeEditorFile
                  isModified={modifiedFileIds.includes(file.id)}
                  key={file.id}
                  file={file}
                  onSelectFile={(file) =>
                    dispatch(CodeEditorActions.setSelectedFileId(file.id))
                  }
                  isHighlighted={selectedFileId === file.id}
                  onDeleteFile={setDeletingFileId}
                  onSave={handleSaveFiles}
                />
              ))}
              {newFileFolder && (
                <div
                  className="relative flex h-[30px] w-full items-center gap-2 rounded border-l-2 border-accent-primary bg-accent-primary-alpha px-3"
                  data-qa="edit-container"
                >
                  <IconFile className="text-secondary" size={18} />
                  <input
                    className="mr-12 w-full flex-1 overflow-hidden text-ellipsis bg-transparent text-left outline-none"
                    type="text"
                    value={newFileName}
                    name="edit-input"
                    onChange={(e) => setNewFileName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUploadEmptyFile(newFileName);
                      }
                    }}
                    autoFocus
                  />
                  <div className="absolute right-1 z-10 flex" data-qa="actions">
                    <SidebarActionButton
                      handleClick={() => handleUploadEmptyFile(newFileName)}
                      dataQA="confirm-edit"
                    >
                      <IconCheck
                        size={18}
                        className="hover:text-accent-primary"
                      />
                    </SidebarActionButton>
                    <SidebarActionButton
                      handleClick={() => {
                        handleUploadEmptyFile(
                          getNextDefaultName('New file', rootFiles),
                        );
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
              <Tooltip tooltip={t('Create file')}>
                <button
                  type="button"
                  onClick={() => {
                    setNewFileFolder(sourcesFolderId);
                    setNewFileName(getNextDefaultName('New file', rootFiles));
                  }}
                  disabled={!!newFileName}
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
              {!!modifiedFileIds.length && (
                <Tooltip tooltip={t('Save all')}>
                  <button
                    type="button"
                    onClick={() => handleSaveFiles(modifiedFileIds)}
                    className="text-secondary hover:text-accent-primary"
                  >
                    <IconDeviceFloppy size={18} />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
          <div className="flex max-h-full min-w-0 shrink grow flex-col divide-y divide-tertiary rounded border border-tertiary bg-layer-3">
            <div className="flex w-full justify-end gap-3 divide-x divide-tertiary py-2">
              <Tooltip tooltip={t(isFullScreen ? 'Minimize' : 'Full screen')}>
                <button
                  type="button"
                  className="px-3 text-secondary hover:text-accent-primary"
                  onClick={(e) => {
                    setIsFullScreen(!isFullScreen);
                    const mouseLeaveEvent = new MouseEvent('mouseleave', {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                    });

                    e.currentTarget.dispatchEvent(mouseLeaveEvent);
                  }}
                >
                  <FullScreenIcon size={18} />
                </button>
              </Tooltip>
            </div>
            <div className="min-h-0 min-w-0 max-w-full shrink grow p-3">
              {selectedFileId && (
                <CodeEditorView selectedFileId={selectedFileId} />
              )}
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
              t(
                'Are you sure that you want to delete "{{name}}" permanently?',
                {
                  name: deletingFileId?.split('/').pop(),
                },
              ) || ''
            }
            confirmLabel={t('Confirm')}
            cancelLabel={t('Cancel')}
            onClose={handleDeleteFile}
          />
        </div>
      </div>
    </>
  );
};
