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

import { useTranslation } from 'next-i18next';

import {
  constructPath,
  getFileNameExtension,
  getFileNameWithoutExtension,
  getFilesWithInvalidFileName,
  getFilesWithInvalidFileSize,
  getFilesWithInvalidFileType,
  notAllowedSymbols,
  prepareFileName,
} from '@/src/utils/app/file';
import { getParentAndCurrentFoldersById } from '@/src/utils/app/folders';
import { getFileRootId } from '@/src/utils/app/id';

import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import Modal from '@/src/components/Common/Modal';

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
  customUploadButtonLabel?: string;
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
  customUploadButtonLabel,
}: Props) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Files);
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
    uploadFolderId || getFileRootId(),
  );

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
          t(`files.error.max_file_size.text`, {
            incorrectSizeFileNames: incorrectSizeFiles.join(', '),
          }),
        );
      }
      if (incorrectTypeFiles.length > 0) {
        errors.push(
          t(`files.error.trying_to_upload.text`, {
            incorrectTypeFileNames: incorrectTypeFiles.join(', '),
          }),
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
                getFileRootId(),
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
    [allowedTypes, folderPath, t],
  );

  const handleUpload = useCallback(() => {
    const errors = [];
    if (attachments.length + selectedFiles.length > maximumAttachmentsAmount) {
      errors.push(
        t(`files.error.max_allowed_attachments.text`, {
          maxAttachmentsAmount: maximumAttachmentsAmount,
          selectedAttachmentsAmount: selectedFiles.length + attachments.length,
        }) as string,
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
        t(`files.error.symbol_not_allowed_and_dot.text`, {
          notAllowedSymbols,
          fileNames: filesWithNotAllowedSymbolsNames.join(', '),
        }) as string,
      );
    } else {
      if (filesWithNotAllowedSymbolsNames.length) {
        errors.push(
          t(`files.error.symbol_not_allowed.text`, {
            notAllowedSymbols,
            fileNames: filesWithNotAllowedSymbolsNames.join(', '),
          }) as string,
        );
      }

      if (filesWithDotInTheEndNames.length) {
        errors.push(
          t(`files.error.using_dot_not_permitted.text`, {
            fileNames: filesWithDotInTheEndNames.join(', '),
          }) as string,
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
        `${errors.length ? '\n' : ''}${t(
          'files.error.files_already_presented.text',
          { fileNames: localIncorrectSameNameFiles.join(', ') },
        )}` as string,
      );
    }

    const duplicateNames = selectedFiles
      .map((file) => file.name)
      .filter((value, index, self) => self.indexOf(value) !== index);
    if (duplicateNames.length) {
      errors.push(
        t(
          `${errors.length ? '\n' : ''}${t(
            'files.error.files_already_have_same_names.text',
            {
              fileNames: duplicateNames.join(', '),
            },
          )}`,
        ) as string,
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
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="flex flex-col gap-2 overflow-auto">
        <div className="flex justify-between">
          <h2 id={headingId} className="text-base font-semibold">
            {t('files.upload_from_device.label')}
          </h2>
        </div>
        <p id={descriptionId} data-qa="supported-attributes">
          {t('files.text.max_file_size')}
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
              <span className="text-xs text-tertiary-bg-light">
                {t('files.button.upload_to')}
              </span>
              <span className="text-xs text-secondary-bg-light">&nbsp;*</span>
            </div>
            <button
              className="flex grow items-center justify-between rounded-primary border border-accent-quaternary bg-transparent px-3 py-2 placeholder:text-tertiary-bg-light focus-within:border-tertiary hover:border-tertiary hover:shadow-primary focus:outline-none"
              onClick={handleFolderChange}
            >
              <span className="truncate">
                {constructPath(t('files.search.button.all_files'), folderPath)}
              </span>
              <span
                className="text-tertiary-bg-light"
                data-qa="change-upload-to"
              >
                {t('files.button.change')}
              </span>
            </button>
          </div>

          {selectedFiles.length !== 0 && (
            <div className="flex flex-col gap-1">
              <div>
                <span className="text-xs text-tertiary-bg-light">
                  {t('files.button.files')}
                </span>
                <span className="text-xs text-secondary-bg-light">&nbsp;*</span>
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
                        className="absolute left-2 top-[calc(50%_-_9px)] shrink-0 text-primary-bg-light"
                        size={18}
                      />
                      <input
                        type="text"
                        value={getFileNameWithoutExtension(file.name)}
                        className="grow text-ellipsis rounded-primary border border-primary bg-transparent py-2 pl-8 pr-12 placeholder:text-tertiary-bg-light focus-within:border-tertiary hover:border-tertiary hover:shadow-primary focus:outline-none"
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
                        className="shrink-0 text-quaternary-bg-light hover:text-primary-bg-light"
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
          className="cursor-pointer rounded py-2.5 text-quaternary-bg-light hover:text-primary-bg-light"
          data-qa="add-more-files"
        >
          {t('files.add_more_files.label')}
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
          className="button button-primary button-medium disabled:cursor-not-allowed"
          onClick={handleUpload}
          disabled={selectedFiles.length === 0}
          data-qa="upload"
        >
          {customUploadButtonLabel
            ? customUploadButtonLabel
            : t('files.button.upload')}
        </button>
      </div>

      <SelectFolderModal
        isOpen={isChangeFolderModalOpened}
        initialSelectedFolderId={selectedFolderId}
        rootFolderId={getFileRootId()}
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
