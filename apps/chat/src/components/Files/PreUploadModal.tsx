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
  getFileWithType,
  getRelativePath,
  getShortExtensionsListFromMimeType,
  notAllowedSymbolsRegex,
  prepareFileName,
  validatePreUploadFiles,
} from '@/src/utils/app/file';
import { getFileRootId, isMyBucket } from '@/src/utils/app/id';
import {
  PreparedUploadFile,
  ResolvedUploadFile,
  applyUploadReplaceActions,
  detectUploadFileConflicts,
} from '@/src/utils/app/prepare-files-for-upload';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { MappedReplaceActions } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

import { REVIEW_FILES_SECTION } from '@/src/constants/fileManager';
import { ChatI18nKeys } from '@/src/constants/i18n';
import { OUTSIDE_PRESS_AND_MOUSE_EVENT } from '@/src/constants/modal';
import { SHARED_WITH_ME_SECTION_NAME } from '@/src/constants/sections';

import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { Modal } from '@/src/components/Common/Modal';
import { ReplaceConfirmationModal } from '@/src/components/Common/ReplaceConfirmationModal/ReplaceConfirmationModal';

import { SelectFolderModal } from './SelectFolderModal';

import {
  ButtonAppearance,
  DialInput,
  DialLinkButton,
  DialPrimaryButton,
  DialPrimaryIconButton,
} from '@epam/ai-dial-ui-kit';

interface Props {
  isOpen: boolean;
  initialFilesSelect?: boolean;
  maximumAttachmentsAmount?: number;
  allowedTypes?: string[];
  allowedTypesLabel?: string;
  onClose: (result: boolean) => void;
  onUploadFiles: (
    selectedFiles: ResolvedUploadFile[],
    folderPath: string | undefined,
  ) => void;
  uploadFolderId?: string;
  customUploadButtonLabel?: string;
  rootFolderId?: string;
  reviewBucket?: string;
}

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
  reviewBucket,
}: Props) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Chat);
  const files = useAppSelector(FilesSelectors.selectFiles);
  const attachments = useAppSelector(FilesSelectors.selectSelectedFiles);
  const folders = useAppSelector(FilesSelectors.selectFolders);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedFiles, setSelectedFiles] = useState<PreparedUploadFile[]>([]);
  const [pendingUploadConflict, setPendingUploadConflict] = useState<{
    duplicatedFiles: DialFile[];
    nonDuplicatedFiles: PreparedUploadFile[];
  } | null>(null);
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

  const folderPath = getRelativePath(selectedFolderId);
  const uploadBucket = useMemo(
    () => bucket ?? splitEntityId(selectedFolderId).bucket,
    [bucket, selectedFolderId],
  );
  const allowedExtensions = useMemo(() => {
    if (allowedTypes.includes('*/*')) {
      return [t(ChatI18nKeys.all)];
    }

    return getShortExtensionsListFromMimeType(allowedTypes, t);
  }, [allowedTypes, t]);

  const handleSelectFiles = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setErrorMessage('');

      const files = Array.from(
        (e.target as HTMLInputElement).files as FileList,
      );

      const { validFiles, errorMsg } = validatePreUploadFiles(
        files,
        allowedTypes,
      );

      if (errorMsg) {
        setErrorMessage(errorMsg);
      }

      setSelectedFiles((oldFiles) =>
        oldFiles.concat(
          validFiles.map((file) => {
            return {
              fileContent: getFileWithType(file),
              id: constructPath(
                getFileRootId(uploadBucket),
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
    [allowedTypes, folderPath, uploadBucket],
  );

  const handleUpload = useCallback(() => {
    const errors: string[] = [];

    if (attachments.length + selectedFiles.length > maximumAttachmentsAmount) {
      errors.push(
        t(ChatI18nKeys.MaxAllowedAttachmentsNumberSelected, {
          maxAttachmentsAmount: maximumAttachmentsAmount,
          selectedAttachmentsAmount: selectedFiles.length + attachments.length,
        }),
      );
    }

    const { duplicatedFiles, nonDuplicatedFiles, errorMsg } =
      detectUploadFileConflicts({
        files: selectedFiles.map((file) => ({
          fileContent: file.fileContent,
          name: file.name,
        })),
        folderId: selectedFolderId,
        existingFiles: files,
        bucket: uploadBucket,
        allowedTypes,
      });

    if (errorMsg) {
      errors.push(errorMsg);
    }

    if (errors.length) {
      setErrorMessage(errors.join('\n'));
      return;
    }

    if (!duplicatedFiles.length && !nonDuplicatedFiles.length) {
      return;
    }

    if (duplicatedFiles.length) {
      setPendingUploadConflict({ duplicatedFiles, nonDuplicatedFiles });
      return;
    }

    onUploadFiles(nonDuplicatedFiles, folderPath);
    onClose(true);
  }, [
    allowedTypes,
    attachments.length,
    files,
    folderPath,
    maximumAttachmentsAmount,
    onClose,
    onUploadFiles,
    selectedFiles,
    selectedFolderId,
    t,
    uploadBucket,
  ]);

  const handleReplaceConfirm = useCallback(
    (mappedActions: MappedReplaceActions) => {
      if (!pendingUploadConflict) {
        return;
      }

      const resolvedFiles = applyUploadReplaceActions({
        duplicatedFiles: pendingUploadConflict.duplicatedFiles,
        nonDuplicatedFiles: pendingUploadConflict.nonDuplicatedFiles,
        mappedActions,
        existingFiles: files,
        folderId: selectedFolderId,
        bucket: uploadBucket,
      });

      setPendingUploadConflict(null);

      if (resolvedFiles.length) {
        onUploadFiles(resolvedFiles, folderPath);
      }

      onClose(true);
    },
    [
      pendingUploadConflict,
      files,
      selectedFolderId,
      uploadBucket,
      folderPath,
      onUploadFiles,
      onClose,
    ],
  );

  const handleReplaceCancel = useCallback(() => {
    setPendingUploadConflict(null);
  }, []);

  const handleRenameFile = useCallback(
    (changedFileIndex: number) => {
      return (rawValue?: string) => {
        const sanitized = rawValue?.replace(notAllowedSymbolsRegex, '') || '';

        const { name: oldName } = selectedFiles[changedFileIndex];
        const ext = oldName.includes('.')
          ? oldName.slice(oldName.lastIndexOf('.'))
          : '';

        const newName = prepareFileName(sanitized + ext);
        setSelectedFiles((files) =>
          files.map((file, i) =>
            i === changedFileIndex
              ? {
                  ...file,
                  name: newName,
                  id: constructPath(
                    getFileRootId(uploadBucket),
                    folderPath,
                    newName,
                  ),
                }
              : file,
          ),
        );
      };
    },
    [folderPath, selectedFiles, uploadBucket],
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
          id: constructPath(getFileRootId(uploadBucket), folderPath),
        }),
      );
    }
  }, [dispatch, folderPath, isOpen, uploadBucket]);

  useEffect(() => {
    if (initialFilesSelect && isOpen) {
      const timeout = setTimeout(() => uploadInputRef.current?.click());
      return () => clearTimeout(timeout);
    }
  }, [initialFilesSelect, isOpen]);

  useEffect(() => {
    setSelectedFiles((oldFiles) =>
      oldFiles.map((file) => {
        const name = prepareFileName(file.name);

        return {
          ...file,
          name,
          id: constructPath(getFileRootId(uploadBucket), folderPath, name),
        };
      }),
    );
  }, [folderPath, uploadBucket]);

  const visiblePath = useMemo(() => {
    const isReview = !!reviewBucket && bucket === reviewBucket;
    let root: string = t(SHARED_WITH_ME_SECTION_NAME);

    if (!bucket || isMyBucket(bucket)) root = t(ChatI18nKeys.MyFiles);
    else if (isReview) root = t(REVIEW_FILES_SECTION);

    return constructPath(
      root,
      folderPath ?? (isReview ? undefined : rootFolderName),
    );
  }, [bucket, reviewBucket, t, folderPath, rootFolderName]);

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
            {t(ChatI18nKeys.UploadFromDevice)}
          </h2>
        </div>
        <p id={descriptionId} data-qa="supported-attributes">
          {t(ChatI18nKeys.MaxFileSizeSupportedTypes, {
            allowedExtensions:
              allowedTypesLabel ||
              allowedExtensions.join(', ') ||
              'no available extensions',
          })}
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
              <span className="text-xs text-secondary">
                {t(ChatI18nKeys.UploadTo)}
              </span>
              <span className="text-xs text-accent-primary">&nbsp;*</span>
            </div>
            <div
              className="flex min-w-0 grow cursor-default items-center justify-between rounded border border-primary bg-transparent px-3 py-2 placeholder:text-secondary hover:border-accent-primary focus:border-accent-primary focus:outline-none"
              data-qa="change-path-container"
            >
              <span className="min-w-0 truncate" data-qa="path">
                {visiblePath}
              </span>
              <DialLinkButton
                className="shrink-0 px-0"
                onClick={handleFolderChange}
                data-qa="change-button"
                label={t(ChatI18nKeys.Change)}
              />
            </div>
          </div>

          {selectedFiles.length !== 0 && (
            <div className="flex flex-col gap-1">
              <div>
                <span className="text-xs text-secondary">
                  {t(ChatI18nKeys.Files)}
                </span>
                <span className="text-xs text-accent-primary">&nbsp;*</span>
              </div>
              <div className="flex flex-col gap-3 overflow-auto text-sm">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3"
                    data-qa="uploaded-file"
                  >
                    <div className="flex-1">
                      <DialInput
                        value={getFileNameWithoutExtension(file.name, {
                          isExtensionIncluded: false,
                        })}
                        onChange={handleRenameFile(index)}
                        postfix={getFileNameExtension(file.name, {
                          isExtensionIncluded: true,
                        })}
                        iconBefore={
                          <IconFile className="text-secondary" size={18} />
                        }
                      />
                    </div>

                    <DialPrimaryIconButton
                      appearance={ButtonAppearance.Ghost}
                      onClick={handleUnselectFile(index)}
                      aria-label="remove-file"
                      icon={<IconTrashX stroke={1.5} />}
                    />
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
          {t(ChatI18nKeys.AddMoreFiles)}
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

        <DialPrimaryButton
          onClick={handleUpload}
          disabled={selectedFiles.length === 0}
          data-qa="upload"
          label={
            customUploadButtonLabel
              ? customUploadButtonLabel
              : t(ChatI18nKeys.Upload)
          }
        />
      </div>

      <SelectFolderModal
        reviewBucket={reviewBucket}
        isOpen={isChangeFolderModalOpened}
        initialSelectedFolderId={selectedFolderId}
        rootFolderId={rootFolderId ?? getFileRootId(uploadBucket)}
        onClose={(folderId) => {
          if (folderId) {
            setSelectedFolderId(folderId);
          } else {
            const root = rootFolderId ?? getFileRootId(uploadBucket);
            if (selectedFolderId && selectedFolderId !== root) {
              const exists = folders.some((f) => f.id === selectedFolderId);
              if (!exists) {
                setSelectedFolderId(root);
              }
            }
          }
          setIsChangeFolderModalOpened(false);
        }}
      />
      {pendingUploadConflict && (
        <ReplaceConfirmationModal
          title={t(ChatI18nKeys.SomeFilesFailedToUploadDuplicateNames)}
          description={t(ChatI18nKeys.AddPostfixIgnoreOrReplaceUpload)}
          cancelLabel={t(ChatI18nKeys.Cancel)}
          confirmLabel={t(ChatI18nKeys.ContinueUpload)}
          onCancel={handleReplaceCancel}
          onConfirm={handleReplaceConfirm}
          duplicatedFiles={pendingUploadConflict.duplicatedFiles}
          cancelDataQa="cancel-upload"
          confirmDataQa="continue-upload"
        />
      )}
    </Modal>
  );
};
