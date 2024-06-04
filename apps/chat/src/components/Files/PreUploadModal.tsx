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
} from '@/src/utils/app/file';
import { getParentAndCurrentFoldersById } from '@/src/utils/app/folders';
import { getRootId } from '@/src/utils/app/id';

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
    uploadFolderId || getRootId(),
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
          t(
            `Max file size up to 512 Mb. Next files haven't been uploaded: {{incorrectSizeFileNames}}`,
            { incorrectSizeFileNames: incorrectSizeFiles.join(', ') },
          ),
        );
      }
      if (incorrectTypeFiles.length > 0) {
        errors.push(
          t(
            `You've trying to upload files with incorrect type: {{incorrectTypeFileNames}}`,
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
              id: constructPath(getRootId(), folderPath, file.name),
              name: file.name,
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
        t(
          `Maximum allowed attachments number is {{maxAttachmentsAmount}}. With your uploadings amount will be {{selectedAttachmentsAmount}}`,
          {
            maxAttachmentsAmount: maximumAttachmentsAmount,
            selectedAttachmentsAmount:
              selectedFiles.length + attachments.length,
          },
        ) as string,
      );
    }
    const incorrectFileNames: string[] = getFilesWithInvalidFileName(
      selectedFiles,
    ).map((file) => file.name);

    if (incorrectFileNames.length > 0) {
      errors.push(
        t(
          `The symbols {{notAllowedSymbols}} are not allowed in file name. Also using a dot at the end of a name is not permitted. Please rename or delete them from uploading files list: {{fileNames}}`,
          {
            notAllowedSymbols,
            fileNames: incorrectFileNames.join(', '),
          },
        ) as string,
      );
    }

    const attachmentsNames = files
      .filter((file) => file.folderId === folderPath)
      .map((file) => file.name);
    const localIncorrectSameNameFiles = selectedFiles
      .filter((file) => attachmentsNames.includes(file.name))
      .map((file) => file.name);
    if (localIncorrectSameNameFiles.length > 0) {
      errors.push(
        t(
          'Files which you trying to upload already presented in selected folder. Please rename or delete them from uploading files list: {{fileNames}}',
          { fileNames: localIncorrectSameNameFiles.join(', ') },
        ) as string,
      );
    }

    const fileNameSet = new Set(selectedFiles.map((file) => file.name));
    if (fileNameSet.size < selectedFiles.length) {
      errors.push(
        t(
          'Files which you trying to upload have same names. Please rename or delete them from uploading files list',
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
                id: constructPath(
                  getRootId(),
                  folderPath,
                  e.target.value + formatFile,
                ),
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
        FilesActions.getFiles({ id: constructPath(getRootId(), folderPath) }),
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
          id: constructPath(getRootId(), folderPath, file.name),
          folderPath,
        };
      }),
    );
  }, [folderPath]);

  return (
    <Modal
      portalId="theme-main"
      containerClassName="flex flex-col gap-4 p-6 md:w-[425px] w-full max-w-[425px]"
      dataQa="pre-upload-modal"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={() => onClose(false)}
      dismissProps={{ outsidePressEvent: 'mousedown' }}
    >
      <div className="flex flex-col gap-2 overflow-auto">
        <div className="flex justify-between">
          <h2 id={headingId} className="text-base font-semibold">
            {t('Upload from device')}
          </h2>
        </div>
        <p id={descriptionId}>{t('Max file size up to 512 Mb.')}</p>

        <ErrorMessage error={errorMessage} />

        <div className="flex flex-col gap-1">
          <div>
            <span className="text-xs text-secondary">{t('Upload to')}</span>
            <span className="text-xs text-accent-primary">&nbsp;*</span>
          </div>
          <button
            className="flex grow items-center justify-between rounded border border-primary bg-transparent px-3 py-2 placeholder:text-secondary hover:border-accent-primary focus:border-accent-primary focus:outline-none"
            onClick={handleFolderChange}
          >
            <span className="truncate">
              {constructPath(t('All files'), folderPath)}
            </span>
            <span className="text-accent-primary">{t('Change')}</span>
          </button>
        </div>

        {selectedFiles.length !== 0 && (
          <div className="flex flex-col gap-1 overflow-auto">
            <div>
              <span className="text-xs text-secondary">{t('Files')}</span>
              <span className="text-xs text-accent-primary">&nbsp;*</span>
            </div>
            <div className="flex flex-col gap-3 overflow-auto text-sm">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-3">
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
                    <span className="absolute right-2">
                      {getFileNameExtension(file.name)}
                    </span>
                  </div>

                  <button onClick={handleUnselectFile(index)}>
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
      <div className="flex w-full justify-between gap-3">
        <label className="cursor-pointer rounded py-2.5 text-accent-primary">
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
          {customUploadButtonLabel
            ? customUploadButtonLabel
            : t('Upload and attach files')}
        </button>
      </div>

      <SelectFolderModal
        isOpen={isChangeFolderModalOpened}
        initialSelectedFolderId={selectedFolderId}
        rootFolderId={getRootId()}
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
