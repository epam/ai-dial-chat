import { IconFile, IconTrashX } from '@tabler/icons-react';
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  constructPath,
  getFileNameExtension,
  getFileNameWithoutExtension,
  getFilesWithInvalidFileName,
  getFilesWithInvalidFileSize,
  getFilesWithInvalidFileType,
  getShortExtensionsListFromMimeType,
  notAllowedSymbols,
  prepareFileName,
} from '@/src/utils/app/file';
import {
  getParentAndCurrentFoldersById,
  splitEntityId,
} from '@/src/utils/app/folders';
import { getFileRootId, isMyBucket } from '@/src/utils/app/id';

import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';
import { SHARED_WITH_ME_SECTION_NAME } from '@/src/constants/sections';

import { Modal } from '@/src/components/Common/Modal';

import { ErrorMessage } from '../Common/ErrorMessage';
import { SelectFolderModal } from './SelectFolderModal';

interface Props {
  isOpen: boolean;
  initialFilesSelect?: boolean;
  maximumAttachmentsAmount?: number;
  allowedTypes?: string[];
  allowedTypesLabel?: string;
  onClose: (result: boolean) => void;
  onUploadFiles: (
    selectedFiles: Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[],
    folderPath: string | undefined,
  ) => void;
  uploadFolderId?: string;
  customUploadButtonLabel?: string;
  rootFolderId?: string;
}

const bytesInMb = 1_048_576;

export const PreUploadDialog = ({
  isOpen,
  initialFilesSelect,
  maximumAttachmentsAmount = 0,
  allowedTypes = [],
  allowedTypesLabel,
  onClose,
  onUploadFiles,
  uploadFolderId,
  customUploadButtonLabel,
  rootFolderId,
}: Props) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Chat);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const attachments = useAppSelector(FilesSelectors.selectSelectedFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedFiles, setSelectedFiles] = useState<
    Required<Pick<DialFile, 'fileContent' | 'id' | 'name'>>[]
  >([]);
  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(
    uploadFolderId || rootFolderId || getFileRootId(),
  );

  const headingId = useId();
  const descriptionId = useId();

  const { bucket, name: rootFolderName } = useMemo(
    () =>
      rootFolderId
        ? splitEntityId(rootFolderId)
        : { bucket: undefined, name: undefined },
    [rootFolderId],
  );

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

    return getShortExtensionsListFromMimeType(allowedTypes, t);
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
      const invalidFileNames = new Set([
        ...incorrectSizeFiles,
        ...incorrectTypeFiles,
      ]);
      const filteredFiles = files.filter(
        (file) => !invalidFileNames.has(file.name),
      );
      const errors = [];
      if (incorrectSizeFiles.length > 0) {
        errors.push(
          t(
            `Max file size up to 512 Mb. Next files haven't been uploaded: {{incorrectSizeFileNames}}`,
            { incorrectSizeFileNames: incorrectSizeFiles.join(', ') },
          ),
        );
      }
      if (incorrectTypeFiles.length > 0) {
        errors.push(
          t(
            `You're trying to upload files with incorrect type: {{incorrectTypeFileNames}}`,
            {
              incorrectTypeFileNames: incorrectTypeFiles.join(', '),
            },
          ),
        );
      }
      if (errors.length) {
        setErrorMessage(errors.join('\n'));
      }

      setSelectedFiles((oldFiles) =>
        oldFiles.concat(
          filteredFiles.map((file) => {
            return {
              fileContent: file,
              id: constructPath(
                getFileRootId(bucket),
                folderPath,
                prepareFileName(file.name),
              ),
              name: prepareFileName(file.name),
            };
          }),
        ),
      );
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
    },
    [allowedTypes, bucket, folderPath, t],
  );

  const handleUpload = useCallback(() => {
    const errors = [];
    if (attachments.length + selectedFiles.length > maximumAttachmentsAmount) {
      errors.push(
        t(
          `Maximum allowed attachments number is {{maxAttachmentsAmount}}. With your uploading amount will be {{selectedAttachmentsAmount}}`,
          {
            maxAttachmentsAmount: maximumAttachmentsAmount,
            selectedAttachmentsAmount:
              selectedFiles.length + attachments.length,
          },
        ),
      );
    }
    const { filesWithNotAllowedSymbols, filesWithDotInTheEnd } =
      getFilesWithInvalidFileName(selectedFiles);
    const filesWithNotAllowedSymbolsNames = filesWithNotAllowedSymbols.map(
      (f) => f.name,
    );
    const filesWithDotInTheEndNames = filesWithDotInTheEnd.map((f) => f.name);

    if (
      filesWithNotAllowedSymbolsNames.length &&
      filesWithDotInTheEndNames.length
    ) {
      errors.push(
        t(
          `The symbols {{notAllowedSymbols}} and a dot at the end are not allowed in file name. Please rename or delete them from uploading files list: {{fileNames}}`,
          {
            notAllowedSymbols,
            fileNames: filesWithNotAllowedSymbolsNames.join(', '),
          },
        ),
      );
    } else {
      if (filesWithNotAllowedSymbolsNames.length) {
        errors.push(
          t(
            `The symbols {{notAllowedSymbols}} are not allowed in file name. Please rename or delete them from uploading files list: {{fileNames}}`,
            {
              notAllowedSymbols,
              fileNames: filesWithNotAllowedSymbolsNames.join(', '),
            },
          ),
        );
      }

      if (filesWithDotInTheEndNames.length) {
        errors.push(
          t(
            `Using a dot at the end of a name is not permitted. Please rename or delete them from uploading files list: {{fileNames}}`,
            {
              fileNames: filesWithDotInTheEndNames.join(', '),
            },
          ),
        );
      }
    }

    const attachmentsSameLevelNames = files
      .filter((file) => file.folderId === selectedFolderId)
      .map((file) => prepareFileName(file.name));
    const localIncorrectSameNameFiles = selectedFiles
      .filter((file) =>
        attachmentsSameLevelNames.includes(prepareFileName(file.name)),
      )
      .map((file) => prepareFileName(file.name));

    if (localIncorrectSameNameFiles.length > 0) {
      errors.push(
        t(
          `${errors.length ? '\n' : ''}Files which you trying to upload already presented in selected folder. Please rename or delete them from uploading files list: {{fileNames}}`,
          { fileNames: localIncorrectSameNameFiles.join(', ') },
        ),
      );
    }

    const duplicateNames = selectedFiles
      .map((file) => file.name)
      .filter((value, index, self) => self.indexOf(value) !== index);
    if (duplicateNames.length) {
      errors.push(
        t(
          `${errors.length ? '\n' : ''}Files which you trying to upload have same names. Please rename or delete them from uploading files list: {{fileNames}}`,
          {
            fileNames: duplicateNames.join(', '),
          },
        ),
      );
    }

    if (errors.length) {
      setErrorMessage(errors.join('\n'));
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
    selectedFolderId,
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
              const fileName = prepareFileName(e.target.value + formatFile);
              return {
                ...file,
                name: fileName,
                id: constructPath(getFileRootId(), folderPath, fileName),
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
      dispatch(
        FilesActions.getFiles({
          id: constructPath(getFileRootId(), folderPath),
        }),
      );
    }
  }, [dispatch, folderPath, isOpen]);

  useEffect(() => {
    if (initialFilesSelect && isOpen) {
      const timeout = setTimeout(() => uploadInputRef.current?.click());
      return () => clearTimeout(timeout);
    }
  }, [initialFilesSelect, isOpen]);

  useEffect(() => {
    setSelectedFiles((oldFiles) =>
      oldFiles.map((file) => {
        return {
          ...file,
          name: prepareFileName(file.name),
          id: constructPath(
            getFileRootId(),
            folderPath,
            prepareFileName(file.name),
          ),
          folderPath,
        };
      }),
    );
  }, [folderPath]);

  return (
    <Modal
      portalId="theme-main"
      containerClassName="flex flex-col gap-4 md:w-[425px] w-full max-w-[425px] px-3 py-4 md:p-6"
      dataQa="pre-upload-modal"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dismissProps={OUTSIDE_PRESS_AND_MOUSE_EVENT}
    >
      <div className="flex flex-col gap-2 overflow-auto">
        <div className="flex justify-between">
          <h2 id={headingId} className="text-base font-semibold">
            {t('Upload from device')}
          </h2>
        </div>
        <p id={descriptionId} data-qa="supported-attributes">
          {t(
            'Max file size up to 512 Mb. Supported types: {{allowedExtensions}}.',
            {
              allowedExtensions:
                allowedTypesLabel ||
                allowedExtensions.join(', ') ||
                'no available extensions',
            },
          )}
        </p>

        <div>
          <ErrorMessage error={errorMessage} />
        </div>

        <div
          className="flex flex-col gap-2 overflow-auto"
          data-qa="uploaded-files"
        >
          <div className="flex flex-col gap-1">
            <div>
              <span className="text-xs text-secondary">{t('Upload to')}</span>
              <span className="text-xs text-accent-primary">&nbsp;*</span>
            </div>
            <button
              className="flex grow cursor-default items-center justify-between rounded border border-primary bg-transparent px-3 py-2 placeholder:text-secondary hover:border-accent-primary focus:border-accent-primary focus:outline-none"
              data-qa="change-path-container"
            >
              <span className="truncate" data-qa="path">
                {!bucket || isMyBucket(bucket)
                  ? constructPath(t('All files'), folderPath ?? rootFolderName)
                  : constructPath(
                      t(SHARED_WITH_ME_SECTION_NAME),
                      folderPath ?? rootFolderName,
                    )}
              </span>
              <span
                className="cursor-pointer text-accent-primary"
                onClick={handleFolderChange}
                data-qa="change-button"
              >
                {t('Change')}
              </span>
            </button>
          </div>

          {selectedFiles.length !== 0 && (
            <div className="flex flex-col gap-1">
              <div>
                <span className="text-xs text-secondary">{t('Files')}</span>
                <span className="text-xs text-accent-primary">&nbsp;*</span>
              </div>
              <div className="flex flex-col gap-3 overflow-auto text-sm">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3"
                    data-qa="uploaded-file"
                  >
                    <div className="relative flex grow items-center">
                      <IconFile
                        className="absolute left-2 top-[calc(50%_-_9px)] shrink-0 text-secondary"
                        size={18}
                      />
                      <input
                        type="text"
                        value={getFileNameWithoutExtension(file.name)}
                        className="grow text-ellipsis rounded border border-primary bg-transparent py-2 pl-8 pr-12 placeholder:text-secondary hover:border-accent-primary focus:border-accent-primary focus:outline-none"
                        onChange={handleRenameFile(index)}
                      />
                      <span
                        className="absolute right-2"
                        data-qa="file-extension"
                      >
                        {getFileNameExtension(file.name)}
                      </span>
                    </div>

                    <button
                      onClick={handleUnselectFile(index)}
                      data-qa="delete-file"
                    >
                      <IconTrashX
                        size={24}
                        className="shrink-0 text-secondary hover:text-accent-primary"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex w-full justify-between gap-3">
        <label
          className="cursor-pointer rounded py-2.5 text-accent-primary"
          data-qa="add-more-files"
        >
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
          data-qa="upload"
        >
          {customUploadButtonLabel ? customUploadButtonLabel : t('Upload')}
        </button>
      </div>

      <SelectFolderModal
        isOpen={isChangeFolderModalOpened}
        initialSelectedFolderId={selectedFolderId}
        rootFolderId={rootFolderId ?? getFileRootId(bucket)}
        onClose={(folderId) => {
          if (folderId) {
            setSelectedFolderId(folderId);
          }
          setIsChangeFolderModalOpened(false);
        }}
      />
    </Modal>
  );
};
