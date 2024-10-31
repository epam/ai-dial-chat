import { Editor } from '@monaco-editor/react';
import { IconTrashX } from '@tabler/icons-react';
import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { UseFormSetValue } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getChildAndCurrentFoldersIdsById } from '@/src/utils/app/folders';
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

import { SelectFolderModal } from '@/src/components/Files/SelectFolderModal';
import Folder from '@/src/components/Folder/Folder';

import { FieldErrorMessage } from '../../Forms/FieldErrorMessage';
import Loader from '../../Loader';
import { FilesRow } from '../../ReplaceConfirmationModal/Components';
import Tooltip from '../../Tooltip';
import { FormData } from '../form';

import { UploadStatus } from '@epam/ai-dial-shared';

interface CodeEditorFile {
  file: DialFile;
  isHighlighted: boolean;
  level?: number;
  onSelectFile: (file: DialFile) => void;
}

const CodeEditorFile = ({
  file,
  onSelectFile,
  isHighlighted,
  level = 0,
}: CodeEditorFile) => {
  return (
    <button type="button" onClick={() => onSelectFile(file)} className="w-full">
      <FilesRow
        item={file}
        level={level}
        featureContainerClassNames="!w-full"
        itemComponentClassNames={classNames(
          '!h-[30px] rounded border-l-2 pr-3',
          isHighlighted
            ? 'border-accent-primary bg-accent-primary-alpha'
            : 'border-transparent',
        )}
      />
    </button>
  );
};

interface CodeEditorProps {
  sourcesFolderId: string | undefined;
  setValue: UseFormSetValue<FormData>;
}

const CodeEditor = ({ sourcesFolderId, setValue }: CodeEditorProps) => {
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
    if (rootFiles.length && !selectedFile) {
      const appFile = rootFiles.find((file) => file.name === 'app.py');
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
    if (uploadedContent) {
      setFileContent(uploadedContent);
    }
  }, [uploadedContent]);

  useEffect(() => {
    if (sourcesFolderId) {
      setValue('sourceFiles', rootFileNames, { shouldValidate: true });
    }
  }, [rootFileNames, setValue, sourcesFolderId]);

  if (!sourcesFolderId) {
    return null;
  }

  return (
    <div className="grid w-full max-w-full grid-cols-[minmax(0,1fr)_2fr] gap-1">
      <div className="flex flex-col gap-0.5 rounded border border-tertiary bg-layer-3 p-3">
        {rootFolders.map((folder) => {
          return (
            <Folder
              key={folder.id}
              searchTerm={''}
              currentFolder={folder}
              allFolders={folders}
              isInitialRenameEnabled
              loadingFolderIds={loadingFolderIds}
              openedFoldersIds={openedFoldersIds}
              allItems={files}
              itemComponent={(props) => (
                <CodeEditorFile
                  level={props.level}
                  file={props.item as DialFile}
                  onSelectFile={setSelectedFile}
                  isHighlighted={selectedFile?.id === props.item.id}
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
          />
        ))}
      </div>
      <div className="h-[400px] w-full rounded border border-tertiary bg-layer-3 p-3">
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
    </div>
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
  const { t } = useTranslation(Translation.Settings);

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
