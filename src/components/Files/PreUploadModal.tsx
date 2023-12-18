import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { IconFile, IconTrashX, IconX } from '@tabler/icons-react';
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import {
  constructPath,
  getExtensionsList,
  getFilesWithInvalidFileSize,
  getFilesWithInvalidFileType,
} from '@/src/utils/app/file';
import { getParentAndCurrentFoldersById } from '@/src/utils/app/folders';

import { DialFile } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { ErrorMessage } from '../Common/ErrorMessage';
import { SelectFolderModal } from './SelectFolderModal';

interface Props {
  isOpen: boolean;
  initialFilesSelect?: boolean;
  maximumAttachmentsAmount?: number;
  allowedTypes?: string[];
  onClose: (result: boolean) => void;
  onUploadFiles: (
    selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
    folderPath: string | undefined,
  ) => void;
  uploadFolderId?: string;
}

const bytesInMb = 1_048_576;

export const PreUploadDialog = ({
  isOpen,
  initialFilesSelect,
  maximumAttachmentsAmount = 0,
  allowedTypes = [],
  onClose,
  onUploadFiles,
  uploadFolderId,
}: Props) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Chat);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const attachments = useAppSelector(FilesSelectors.selectSelectedFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const [selectedFiles, setSelectedFiles] = useState<
    Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[]
  >([]);
  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(uploadFolderId);

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: onClose,
  });
  const role = useRole(context);
  const dismiss = useDismiss(context, { outsidePressEvent: 'mousedown' });
  const { getFloatingProps } = useInteractions([role, dismiss]);
  const headingId = useId();
  const descriptionId = useId();

  const folderPath = useMemo(() => {
    return (
      getParentAndCurrentFoldersById(folders, selectedFolderId)
        .map((folder) => folder.name)
        .reverse()
        .join('/') || undefined
    );
  }, [folders, selectedFolderId]);
  const allowedExtensions = useMemo(() => {
    if (allowedTypes.includes('*/*')) {
      return [t('all')];
    }
    return allowedTypes
      .map((mimeType) => getExtensionsList(mimeType))
      .flat()
      .map((type) => `.${type}`);
  }, [allowedTypes, t]);

  const handleSelectFiles = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setErrorMessage('');

      const files = Array.from(
        (e.target as HTMLInputElement).files as FileList,
      );

      const incorrectSizeFiles: string[] = getFilesWithInvalidFileSize(
        files,
        512 * bytesInMb,
      ).map((file) => file.name);
      const incorrectTypeFiles: string[] = getFilesWithInvalidFileType(
        files,
        allowedTypes,
      ).map((file) => file.name);
      const filteredFiles = files.filter(
        (file) =>
          !incorrectSizeFiles.includes(file.name) &&
          !incorrectTypeFiles.includes(file.name),
      );

      if (incorrectSizeFiles.length > 0) {
        setErrorMessage(
          (oldMessage) =>
            oldMessage +
            '\n' +
            t(
              `Max file size up to 512 Mb. Next files haven't been uploaded: {{incorrectSizeFileNames}}`,
              { incorrectSizeFileNames: incorrectSizeFiles.join(', ') },
            ),
        );
      }
      if (incorrectTypeFiles.length > 0) {
        setErrorMessage(
          (oldMessage) =>
            oldMessage +
            '\n' +
            t(
              `Supported types: {{allowedExtensions}}. Next files haven't been uploaded: {{incorrectTypeFileNames}}`,
              {
                allowedExtensions: allowedExtensions.join(', '),
                incorrectTypeFileNames: incorrectTypeFiles.join(', '),
              },
            ),
        );
      }

      setSelectedFiles((oldFiles) =>
        oldFiles.concat(
          filteredFiles.map((file) => {
            return {
              fileContent: file,
              id: constructPath(file.name, folderPath),
              name: file.name,
            };
          }),
        ),
      );
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
    },
    [allowedExtensions, allowedTypes, folderPath, t],
  );

  const handleUpload = useCallback(() => {
    if (attachments.length + selectedFiles.length > 10) {
      setErrorMessage(
        t(
          `Maximum allowed attachments number is {{maxAttachmentsAmount}}. With your uploadings amount will be {{selectedAttachmentsAmount}}`,
          {
            maxAttachmentsAmount: maximumAttachmentsAmount,
            selectedAttachmentsAmount:
              selectedFiles.length + attachments.length,
          },
        ) as string,
      );
      return;
    }

    const attachmentsNames = files
      .filter((file) => file.folderId === folderPath)
      .map((file) => file.name);
    const localIncorrectSameNameFiles = selectedFiles
      .filter((file) => attachmentsNames.includes(file.name))
      .map((file) => file.name);
    if (localIncorrectSameNameFiles.length > 0) {
      setErrorMessage(
        t(
          'Files which you trying to upload already presented in selected folder. Please rename or remove them from uploading files list: {{fileNames}}',
          { fileNames: localIncorrectSameNameFiles.join(', ') },
        ) as string,
      );
      return;
    }
    let isFilesNamesSame = false;
    for (let i = 0; i < selectedFiles.length - 1; i++) {
      for (let j = i + 1; j < selectedFiles.length; j++) {
        if (selectedFiles[i].name === selectedFiles[j].name) {
          isFilesNamesSame = true;
          break;
        }
      }
      if (isFilesNamesSame) {
        break;
      }
    }
    if (isFilesNamesSame) {
      setErrorMessage(
        t(
          'Files which you trying to upload have same names. Please rename or remove them from uploading files list',
        ) as string,
      );
      return;
    }

    onUploadFiles(selectedFiles, folderPath);

    onClose(true);
  }, [
    attachments.length,
    files,
    folderPath,
    maximumAttachmentsAmount,
    onClose,
    onUploadFiles,
    selectedFiles,
    t,
  ]);

  const handleRenameFile = useCallback(
    (changedFileIndex: number) => {
      return (e: ChangeEvent<HTMLInputElement>) =>
        setSelectedFiles(
          selectedFiles.map((file, index) => {
            if (index === changedFileIndex) {
              const indexDot = file.name.lastIndexOf('.');
              const formatFile =
                indexDot !== -1 ? file.name.slice(indexDot) : '';
              return {
                ...file,
                name: e.target.value + formatFile,
                id: constructPath(e.target.value + formatFile, folderPath),
              };
            }

            return file;
          }),
        );
    },
    [folderPath, selectedFiles],
  );

  const handleFolderChange = useCallback(() => {
    setIsChangeFolderModalOpened(true);
  }, []);

  const handleUnselectFile = useCallback(
    (unselectedFileIndex: number) => {
      return () =>
        setSelectedFiles(
          selectedFiles.filter((_, index) => unselectedFileIndex !== index),
        );
    },
    [selectedFiles],
  );

  useEffect(() => {
    if (isOpen) {
      dispatch(FilesActions.getFiles({ path: folderPath }));
    }
  }, [dispatch, folderPath, isOpen]);

  useEffect(() => {
    if (initialFilesSelect && isOpen) {
      setTimeout(() => uploadInputRef.current?.click());
    }
  }, [initialFilesSelect, isOpen]);

  useEffect(() => {
    setSelectedFiles((oldFiles) =>
      oldFiles.map((file) => {
        return {
          ...file,
          id: constructPath(file.name, folderPath),
          folderPath,
        };
      }),
    );
  }, [folderPath]);

  return (
    <>
      <FloatingPortal id="theme-main">
        {isOpen && (
          <FloatingOverlay
            lockScroll
            className="z-50 flex items-center justify-center bg-gray-900/70 p-3 dark:bg-gray-900/30"
          >
            <FloatingFocusManager context={context}>
              <div
                className="relative flex max-h-full flex-col gap-4 rounded bg-gray-100 p-6 dark:bg-gray-700 md:min-w-[425px] md:max-w-[500px]"
                ref={refs.setFloating}
                {...getFloatingProps()}
              >
                <button
                  className="absolute right-2 top-2"
                  onClick={() => onClose(false)}
                >
                  <IconX className="text-gray-500 hover:text-blue-500" />
                </button>
                <div className="flex flex-col gap-2 overflow-auto">
                  <div className="flex justify-between">
                    <h2 id={headingId} className="text-base font-semibold">
                      {t('Upload from device')}
                    </h2>
                  </div>
                  <p id={descriptionId}>
                    {t(
                      'Max file size up to 512 Mb. Supported types: {{allowedExtensions}}.',
                      {
                        allowedExtensions: allowedExtensions.join(', '),
                      },
                    )}
                  </p>

                  <ErrorMessage error={errorMessage} />

                  <div className="flex flex-col gap-1">
                    <div>
                      <span className="text-xs text-gray-500">
                        {t('Upload to')}
                      </span>
                      <span className="text-xs text-blue-500">&nbsp;*</span>
                    </div>
                    <button
                      className="flex grow items-center justify-between rounded border border-gray-400 bg-transparent px-3 py-2 placeholder:text-gray-500 hover:border-blue-500 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:hover:border-blue-500 dark:focus:border-blue-500"
                      onClick={handleFolderChange}
                    >
                      <span className="truncate">
                        {constructPath(t('All files'), folderPath)}
                      </span>
                      <span className="text-blue-500">{t('Change')}</span>
                    </button>
                  </div>

                  {selectedFiles.length !== 0 && (
                    <div className="flex flex-col gap-1 overflow-auto">
                      <div>
                        <span className="text-xs text-gray-500">
                          {t('Files')}
                        </span>
                        <span className="text-xs text-blue-500">&nbsp;*</span>
                      </div>
                      <div className="flex flex-col gap-3 overflow-auto text-sm">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <div className="relative flex grow items-center">
                              <IconFile
                                className="absolute left-2 top-[calc(50%_-_9px)] shrink-0 text-gray-500"
                                size={18}
                              />
                              <input
                                type="text"
                                value={file.name.slice(
                                  0,
                                  file.name.lastIndexOf('.'),
                                )}
                                className="grow text-ellipsis rounded border border-gray-400 bg-transparent px-8 py-2 placeholder:text-gray-500 hover:border-blue-500 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:hover:border-blue-500 dark:focus:border-blue-500"
                                onChange={handleRenameFile(index)}
                              />
                              <span className="absolute right-2">
                                {file.name.slice(file.name.lastIndexOf('.'))}
                              </span>
                            </div>

                            <button onClick={handleUnselectFile(index)}>
                              <IconTrashX
                                size={24}
                                className="shrink-0 text-gray-500 hover:text-blue-500"
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex w-full justify-between gap-3">
                  <label className="cursor-pointer rounded py-2.5 text-blue-500">
                    {t('Add more files...')}
                    <input
                      ref={uploadInputRef}
                      id="file"
                      type="file"
                      className="hidden"
                      multiple
                      accept={allowedTypes.join()}
                      onChange={handleSelectFiles}
                    />
                  </label>

                  <button
                    className="button button-primary"
                    onClick={handleUpload}
                    disabled={selectedFiles.length === 0}
                  >
                    {t('Upload and attach files')}
                  </button>
                </div>

                <SelectFolderModal
                  isOpen={isChangeFolderModalOpened}
                  selectedFolderName={selectedFolderId}
                  onClose={(folderId) => {
                    if (typeof folderId !== 'boolean') {
                      setSelectedFolderId(folderId);
                    }
                    setIsChangeFolderModalOpened(false);
                  }}
                />
              </div>
            </FloatingFocusManager>
          </FloatingOverlay>
        )}
      </FloatingPortal>
    </>
  );
};
