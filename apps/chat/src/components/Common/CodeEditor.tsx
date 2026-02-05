import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconCheck,
  IconDeviceFloppy,
  IconFile,
  IconFilePlus,
  IconUpload,
} from '@tabler/icons-react';
import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  dispatchMouseLeaveEvent,
  getLastPathSegment,
} from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import {
  getChildAndCurrentFoldersIdsById,
  getNextDefaultName,
} from '@/src/utils/app/folders';
import { getIdWithoutRootPathSegments } from '@/src/utils/app/id';
import { isHiddenEntity } from '@/src/utils/app/search';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { CodeEditorActions, FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { CodeEditorSelectors, FilesSelectors } from '@/src/store/selectors';

import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';

import { SidebarActionButton } from '@/src/components/Buttons/SidebarActionButton';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Loader } from '@/src/components/Common/Loader';
import { MonacoEditor } from '@/src/components/Common/MonacoEditor';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { FileItem } from '@/src/components/Files/FileItem';
import { PreUploadDialog } from '@/src/components/Files/PreUploadModal';
import { Folder } from '@/src/components/Folder/Folder';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import MoveLeftIcon from '@/public/images/icons/move-left.svg';
import MoveRightIcon from '@/public/images/icons/move-right.svg';
import { UploadStatus } from '@epam/ai-dial-shared';
import { DialButton, DialCloseButton } from '@epam/ai-dial-ui-kit';
import debounce, { DebouncedFunc } from 'lodash-es/debounce';
import * as monaco from 'monaco-editor';

interface CodeEditorFileProps {
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
}: CodeEditorFileProps) => {
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
  readOnly?: boolean;
}

export const CodeEditorView = ({
  selectedFileId,
  readOnly,
}: CodeEditorViewProps) => {
  const dispatch = useAppDispatch();

  const selectFileContentSelector = useMemo(
    () => CodeEditorSelectors.selectFileContent(selectedFileId),
    [selectedFileId],
  );
  const fileContent = useAppSelector(selectFileContentSelector);
  const isContentLoading = useAppSelector(
    CodeEditorSelectors.selectIsFileContentLoading,
  );

  const [isEditorReady, setIsEditorReady] = useState(false);

  const debouncedChangeHandlerRef = useRef<DebouncedFunc<
    (content: string) => void
  > | null>(null);
  const fileContentRef = useRef<typeof fileContent | undefined>(fileContent);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const modelCacheRef = useRef<
    Record<string, monaco.editor.ITextModel | undefined>
  >({});
  const contentRef = useRef<string | null>(null);
  const editorAliveRef = useRef<boolean>(false);
  const lastCursorPosRef = useRef<Record<string, monaco.IPosition | undefined>>(
    {},
  );

  const editorOptions = useMemo(
    () => (readOnly ? { readOnly: true } : undefined),
    [readOnly],
  );

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

  const detectLanguageIdFromPath = useCallback((path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const langs = monacoRef.current?.languages.getLanguages() ?? [];
    const found = langs.find((l) =>
      (l.extensions ?? []).some((e) => e.replace(/^\./, '') === ext),
    );
    return found?.id ?? 'plaintext';
  }, []);

  useEffect(() => {
    if (
      isEditorReady &&
      monacoRef.current &&
      editorRef.current &&
      typeof contentRef.current === 'string' &&
      !isContentLoading
    ) {
      if (!editorAliveRef.current) return;

      const uri = monacoRef.current.Uri.file(selectedFileId);
      const languageId = detectLanguageIdFromPath(selectedFileId);
      if (
        !modelCacheRef.current[selectedFileId] ||
        modelCacheRef.current[selectedFileId]?.isDisposed()
      ) {
        modelCacheRef.current[selectedFileId] =
          monacoRef.current.editor.createModel(
            contentRef.current,
            languageId,
            uri,
          );
      }

      const model = modelCacheRef.current[selectedFileId]!;
      editorRef.current.setModel(model);

      const key = uri.toString();
      const pos = lastCursorPosRef.current[key] ?? { lineNumber: 1, column: 1 };
      editorRef.current.setPosition(pos);
      editorRef.current.revealPositionInCenterIfOutsideViewport(pos);
      editorRef.current.focus();
    }
  }, [
    selectedFileId,
    isEditorReady,
    isContentLoading,
    detectLanguageIdFromPath,
  ]);

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

      editorAliveRef.current = true;
      codeEditor.onDidDispose(() => {
        editorAliveRef.current = false;
      });

      codeEditor.onDidChangeCursorPosition(() => {
        const model = codeEditor.getModel();
        if (model) {
          lastCursorPosRef.current[model.uri.toString()] =
            codeEditor.getPosition() ?? { lineNumber: 1, column: 1 };
        }
      });
      codeEditor.onDidChangeModel((e) => {
        const key = e.newModelUrl?.toString();
        const pos = (key && lastCursorPosRef.current[key]) || {
          lineNumber: 1,
          column: 1,
        };

        codeEditor.setPosition(pos);
        codeEditor.revealPositionInCenterIfOutsideViewport(pos);
        codeEditor.focus();
      });

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
    <MonacoEditor
      onChange={handleDebouncedChange}
      onMount={handleEditorMount}
      beforeMount={handleBeforeEditorMount}
      options={editorOptions}
    />
  );
};

interface Props {
  sourcesFolderId: string | undefined;
  readOnly?: boolean;
}

const ALLOWED_PRE_UPLOAD_DIALOG_TYPES = ['*/*'];

export const CodeEditor = ({ sourcesFolderId, readOnly }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const loadingFolderIds = useAppSelector(
    FilesSelectors.selectLoadingFolderIds,
  );
  const allFiles = useAppSelector(FilesSelectors.selectFiles);
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const files = useMemo(
    () => allFiles.filter((file) => !isHiddenEntity(file)),
    [allFiles],
  );

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

  const { bucket, parentPath } = useMemo(() => {
    if (sourcesFolderId) {
      const { bucket, parentPath } = splitEntityId(sourcesFolderId);
      return { bucket, parentPath };
    }
    return { bucket: undefined, parentPath: undefined };
  }, [sourcesFolderId]);

  useEffect(() => {
    if (sourcesFolderId) {
      dispatch(CodeEditorActions.initCodeEditor({ sourcesFolderId }));
    }
  }, [dispatch, sourcesFolderId]);

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

  const openUploadDialog = useCallback(() => {
    setUploadFolderId(sourcesFolderId);
    dispatch(FilesActions.getFolders({ id: parentPath }));
  }, [dispatch, parentPath, sourcesFolderId]);

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
            bucket,
          }),
        );
      });
    },
    [bucket, dispatch],
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
            bucket,
          }),
        );
        setNewFileFolder(undefined);
        setNewFileName('');
      }
    },
    [bucket, dispatch, sourcesFolderId],
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

  const handleSidebarToggle = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsSidebarOpen((prev) => !prev);
    },
    [],
  );

  const handleUploadFilesClose = useCallback(() => {
    setUploadFolderId(undefined);
  }, []);

  const handleSelectFile = useCallback(
    (file: DialFile) => {
      dispatch(CodeEditorActions.setSelectedFileId(file.id));
    },
    [dispatch],
  );

  const FullScreenIcon = useMemo(
    () => (isFullScreen ? IconArrowsMinimize : IconArrowsMaximize),
    [isFullScreen],
  );

  if (!sourcesFolderId) {
    return null;
  }

  return (
    <div className="z-40 w-full max-w-full">
      <div
        className={classNames(
          'grid min-h-[400px] w-full max-w-full grid-rows-[100%]',
          isFullScreen ? 'fixed inset-0 z-50' : 'h-[400px]',
          isSidebarOpen ? 'grid-cols-[220px_1fr]' : 'grid-cols-[0px_1fr]',
        )}
      >
        <div className="flex max-h-full flex-col divide-y divide-tertiary overflow-hidden rounded-l border border-tertiary bg-layer-3">
          <div className="flex w-full shrink-0">
            <Tooltip tooltip={t('Hide file list')} isTriggerClickable>
              <DialButton
                onClick={handleSidebarToggle}
                className="border-r border-tertiary px-3 py-2 text-secondary hover:text-accent-primary"
                iconBefore={<MoveLeftIcon width={18} height={18} />}
              />
            </Tooltip>
          </div>
          <div className="grow overflow-y-auto p-3">
            {rootFolders.map((folder) => {
              return (
                <Folder
                  maxDepth={MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH}
                  key={folder.id}
                  searchTerm=""
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
                      file={props.item}
                      onSelectFile={handleSelectFile}
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
                onSelectFile={handleSelectFile}
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
                    iconBefore={
                      <IconCheck
                        size={18}
                        className="hover:text-accent-primary"
                      />
                    }
                  />
                  <DialCloseButton
                    onClose={() => {
                      handleUploadEmptyFile(
                        getNextDefaultName('New file', rootFiles),
                      );
                    }}
                    data-qa="cancel-edit"
                    size={18}
                  />
                </div>
              </div>
            )}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Tooltip tooltip={t('Add new folder')}>
                <DialButton
                  onClick={() =>
                    dispatch(
                      FilesActions.addNewFolder({ parentId: sourcesFolderId }),
                    )
                  }
                  className="text-secondary hover:text-accent-primary"
                  iconBefore={<FolderPlus height={18} width={18} />}
                />
              </Tooltip>
              <Tooltip tooltip={t('Create file')}>
                <DialButton
                  onClick={() => {
                    setNewFileFolder(sourcesFolderId);
                    setNewFileName(getNextDefaultName('New file', rootFiles));
                  }}
                  disabled={!!newFileName}
                  className="text-secondary hover:text-accent-primary"
                  iconBefore={<IconFilePlus size={18} />}
                />
              </Tooltip>
              <Tooltip tooltip={t('Upload file')}>
                <DialButton
                  onClick={openUploadDialog}
                  className="text-secondary hover:text-accent-primary"
                  iconBefore={<IconUpload size={18} />}
                />
              </Tooltip>
              {!!modifiedFileIds.length && (
                <Tooltip tooltip={t('Save all')}>
                  <DialButton
                    onClick={() => handleSaveFiles(modifiedFileIds)}
                    className="text-secondary hover:text-accent-primary"
                    iconBefore={<IconDeviceFloppy size={18} />}
                  />
                </Tooltip>
              )}
            </div>
          )}
        </div>
        <div className="flex max-h-full min-w-0 flex-col divide-y divide-tertiary rounded-r border border-tertiary bg-layer-3">
          <div className="flex w-full shrink-0 justify-end">
            {!isSidebarOpen && (
              <Tooltip
                tooltip={t('Show file list')}
                isTriggerClickable
                triggerClassName="mr-auto"
              >
                <DialButton
                  onClick={handleSidebarToggle}
                  className="border-r border-tertiary px-3 py-2 text-secondary hover:text-accent-primary"
                  iconBefore={<MoveRightIcon width={18} height={18} />}
                />
              </Tooltip>
            )}

            <Tooltip tooltip={t(isFullScreen ? 'Minimize' : 'Full screen')}>
              <DialButton
                className="border-l border-tertiary px-3 py-2 text-secondary hover:text-accent-primary"
                onClick={(e) => {
                  setIsFullScreen(!isFullScreen);
                  dispatchMouseLeaveEvent(e);
                }}
                iconBefore={<FullScreenIcon size={18} />}
              />
            </Tooltip>
          </div>
          <div className="min-h-0 min-w-0 max-w-full shrink grow p-3">
            {selectedFileId && (
              <CodeEditorView
                selectedFileId={selectedFileId}
                readOnly={readOnly}
              />
            )}
          </div>
        </div>
        {uploadFolderId && (
          <PreUploadDialog
            uploadFolderId={uploadFolderId}
            isOpen
            allowedTypes={ALLOWED_PRE_UPLOAD_DIALOG_TYPES}
            initialFilesSelect
            onUploadFiles={handleUploadFiles}
            onClose={handleUploadFilesClose}
            maximumAttachmentsAmount={Number.MAX_SAFE_INTEGER}
            rootFolderId={sourcesFolderId}
          />
        )}
        <ConfirmDialog
          isOpen={!!deletingFileId}
          heading={t('Confirm deleting')}
          description={t(
            'Are you sure that you want to delete "{{name}}" permanently?',
            {
              name: getLastPathSegment(deletingFileId ?? ''),
            },
          )}
          confirmLabel={t('Confirm')}
          cancelLabel={t('Cancel')}
          onClose={handleDeleteFile}
        />
      </div>
    </div>
  );
};
