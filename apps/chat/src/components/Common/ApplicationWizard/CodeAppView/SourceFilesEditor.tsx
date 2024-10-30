import { Editor } from '@monaco-editor/react';
import { IconTrashX } from '@tabler/icons-react';
import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  getFileRootId,
  getIdWithoutRootPathSegments,
} from '@/src/utils/app/id';

import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { SelectFolderModal } from '@/src/components/Files/SelectFolderModal';

import Loader from '../../Loader';
import { FilesRow } from '../../ReplaceConfirmationModal/Components';
import Tooltip from '../../Tooltip';

interface SourceFilesEditorProps {
  value?: string;
  onChange?: (v: string) => void;
}

const _SourceFilesEditor: FC<SourceFilesEditorProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation(Translation.Settings);

  const dispatch = useAppDispatch();

  const theme = useAppSelector(UISelectors.selectThemeState);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const uploadedContent = useAppSelector(FilesSelectors.selectFileContent);
  const isUploadingContent = useAppSelector(
    FilesSelectors.selectIsFileContentLoading,
  );

  const [selectedFile, setSelectedFile] = useState<DialFile>();
  const [fileContent, setFileContent] = useState<string | undefined>(
    uploadedContent,
  );
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  const folderFiles = useMemo(() => {
    if (value) {
      return files.filter((file) => file.id.startsWith(value));
    }
    return [];
  }, [files, value]);

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

  const handleSelectFile = (file: DialFile) => {
    setSelectedFile(file);
  };

  useEffect(() => {
    if (folderFiles.length && !selectedFile) {
      const appFile = folderFiles.find((file) => file.name === 'app.py');
      if (appFile) {
        setSelectedFile(appFile);
      } else {
        setSelectedFile(folderFiles[0]);
      }
    }
  }, [folderFiles, selectedFile]);

  useEffect(() => {
    if (value) {
      dispatch(FilesActions.getFilesWithFolders({ id: value }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-2">
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

        {value && (
          <div className="grid w-full grid-cols-[1fr_2fr] gap-1">
            <div className="flex w-full flex-col gap-0.5 rounded border border-tertiary bg-layer-3 p-3">
              {folderFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => handleSelectFile(file)}
                  className="block w-full"
                >
                  <FilesRow
                    item={file}
                    featureContainerClassNames="!w-full"
                    itemComponentClassNames={classNames(
                      '!h-[30px] w-full rounded',
                      selectedFile?.id === file.id
                        ? 'border-l-2 border-accent-primary bg-accent-primary-alpha'
                        : 'border-l-2 border-transparent',
                    )}
                  />
                </button>
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
        )}
      </div>

      <SelectFolderModal
        isOpen={isFolderModalOpen}
        initialSelectedFolderId={getFileRootId()}
        rootFolderId={getFileRootId()}
        onClose={handleCloseFileManager}
      />
    </div>
  );
};

export const SourceFilesEditor = memo(_SourceFilesEditor);
