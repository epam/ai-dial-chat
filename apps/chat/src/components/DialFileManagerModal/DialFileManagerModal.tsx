import {
  isMimeTypeAllowed,
  mimeTypesToExtensionLabels,
} from '@epam/ai-dial-attachment-input';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
  mimeTypesToAttachmentExtensionLabels,
  mimeTypesToDialFileAcceptTypes,
  useDialFileManager,
  useDialFileManagerTabConfig,
} from '@epam/ai-dial-chat-hooks';
import {
  FileManagerAttachModal,
  formatFileSize,
  isHiddenPath,
  type AttachResult,
  type FileManagerAttachModalLabels,
} from '@epam/ai-dial-chat-shared';
import {
  DialFileNodeType,
  type DialFile,
  type FileManagerGridRow,
} from '@epam/ai-dial-react-file-manager';
import {
  DialFileManagerTabs,
  NOT_ALLOWED_SYMBOLS,
  NOT_ALLOWED_SYMBOLS_REGEXP,
  useDialFileManagerTabs,
} from '@epam/ai-dial-ui-kit';
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useNotification } from '../../context/NotificationContext';
import { useDialFileManagerHostOptions } from '../DialFileManagerShell/useDialFileManagerHostOptions';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (result: AttachResult) => void;
  bucket: string;
  title: string;
  attachLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  errorMessage: string;
  retryLabel: string;
  hiddenFilesLabel: string;
  showHiddenFilesLabel: string;
  hideHiddenFilesLabel: string;
  getSelectionLabel: (count: number) => string;
  uploadFilesLabel: string;
  newFolderLabel: string;
  downloadLabel: string;
  downloadingLabel: string;
  deleteLabel: string;
  deletingLabel: string;
  deleteConfirmTitle: (names: string[]) => ReactNode;
  deleteConfirmBody: (names: string[]) => ReactNode;
  deleteConfirmLabel: string;
  deleteCancelLabel: string;
  uploadProgressTitle: string;
  cancelLabel: string;
  allowedTypes?: string[];
  maxSelectableFileSize?: number;
  maximumAttachmentsAmount?: number;
  existingAttachmentsAmount?: number;
  canAttachFolders?: boolean;
  allowedTypesLabel?: string;
  autoSelectUploadedItems?: boolean;
}

const DialFileManagerModal: FC<Props> = ({
  isOpen,
  onClose,
  onAttach,
  bucket,
  title,
  attachLabel,
  emptyTitle,
  emptyDescription,
  errorMessage,
  retryLabel,
  hiddenFilesLabel,
  showHiddenFilesLabel,
  hideHiddenFilesLabel,
  getSelectionLabel,
  uploadFilesLabel,
  newFolderLabel,
  downloadLabel,
  downloadingLabel,
  deleteLabel,
  deletingLabel,
  deleteConfirmTitle,
  deleteConfirmBody,
  deleteConfirmLabel,
  deleteCancelLabel,
  uploadProgressTitle,
  cancelLabel,
  allowedTypes,
  maxSelectableFileSize,
  maximumAttachmentsAmount,
  existingAttachmentsAmount = 0,
  canAttachFolders = false,
  allowedTypesLabel,
  autoSelectUploadedItems = false,
}) => {
  const { t } = useTranslation();
  const { showInfoNotification, showErrorNotification } = useNotification();
  const {
    config: { fileManagerTabs },
  } = useAppConfig();
  const hostOptions = useDialFileManagerHostOptions();

  const tabLabels = useMemo(
    () => ({
      [DialFileManagerTabs.MyFiles]: t(DialFileManagerI18nKeys.TabMyFiles),
      [DialFileManagerTabs.Shared]: t(DialFileManagerI18nKeys.TabShared),
      [DialFileManagerTabs.Organization]: t(BasicI18nKeys.Organization),
      [DialFileManagerTabs.Review]: '',
    }),
    [t],
  );

  const {
    activeTab,
    handleTabChange: handleTabChangeRaw,
    tabs: allTabs,
  } = useDialFileManagerTabs(tabLabels, DialFileManagerTabs.MyFiles);

  const [selectedPaths, setSelectedPaths] = useState(() => new Set<string>());

  const handleSelectedPathsChange = useCallback((paths: Set<string>) => {
    setSelectedPaths(new Set([...paths].filter((p) => !isHiddenPath(p))));
  }, []);

  const handleTabChange = useCallback(
    (tab: DialFileManagerTabs) => {
      setSelectedPaths(new Set());
      handleTabChangeRaw(tab);
    },
    [handleTabChangeRaw],
  );

  const rootLabel =
    tabLabels[activeTab] || tabLabels[DialFileManagerTabs.MyFiles];

  const { tabs } = useDialFileManagerTabConfig(
    activeTab,
    handleTabChange,
    allTabs,
    fileManagerTabs,
  );

  const hookResult = useDialFileManager({
    ...hostOptions,
    bucket,
    activeTab,
    rootLabel,
    variant: DialFileManagerVariant.Attach,
    forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP,
  });

  const { isAnyOperationInProgress } = hookResult;

  const handleSkippedUnsupportedFiles = useCallback(() => {
    showInfoNotification({
      message: t(DialFileManagerI18nKeys.UnsupportedFilesDescription),
      title: t(DialFileManagerI18nKeys.UnsupportedFilesSkipped),
    });
  }, [showInfoNotification, t]);

  const handleCountLimitExceeded = useCallback(
    (totalCount: number, limit: number) => {
      showErrorNotification({
        message: t(DialFileManagerI18nKeys.TooManyFilesDescription, {
          count: totalCount,
          limit,
        }),
        title: t(DialFileManagerI18nKeys.TooManyFilesSelected),
      });
    },
    [showErrorNotification, t],
  );

  const isFileTypeAllowed = useCallback(
    (contentType: string): boolean => {
      if (allowedTypes == null || allowedTypes.length === 0) return true;
      return isMimeTypeAllowed(contentType, allowedTypes);
    },
    [allowedTypes],
  );

  const getDisabledTooltip = useCallback(
    (row: FileManagerGridRow) => {
      if (isHiddenPath(row.path)) {
        return t(DialFileManagerI18nKeys.AttachingHiddenFilesNotAllowed);
      }
      return undefined;
    },
    [t],
  );

  const isRowSelectable = useCallback(
    (node: { data?: FileManagerGridRow | null }) => {
      const row = node.data;
      if (row == null) return false;

      if (isHiddenPath(row.path)) return false;

      if (row.nodeType === DialFileNodeType.FOLDER) {
        return canAttachFolders;
      }

      if (row.nodeType === DialFileNodeType.ITEM) {
        if (
          allowedTypes != null &&
          allowedTypes.length > 0 &&
          row.contentType != null &&
          !isMimeTypeAllowed(row.contentType, allowedTypes)
        ) {
          return false;
        }

        if (
          maxSelectableFileSize != null &&
          row.contentLength != null &&
          row.contentLength > maxSelectableFileSize
        ) {
          return false;
        }

        return true;
      }

      return false;
    },
    [canAttachFolders, allowedTypes, maxSelectableFileSize],
  );

  const headerDescription = useMemo(() => {
    const hasTypeConstraint = allowedTypes != null && allowedTypes.length > 0;
    const hasSizeConstraint =
      maxSelectableFileSize != null && maxSelectableFileSize > 0;
    const hasCountConstraint =
      maximumAttachmentsAmount != null &&
      maximumAttachmentsAmount > 0 &&
      isFinite(maximumAttachmentsAmount);

    if (!hasTypeConstraint && !hasSizeConstraint && !hasCountConstraint) {
      return null;
    }

    const parts: string[] = [];

    if (hasTypeConstraint || hasSizeConstraint) {
      const isAllTypesAllowed =
        hasTypeConstraint &&
        (allowedTypes ?? []).some((type) => type === '*' || type === '*/*');

      const typeLabel =
        allowedTypesLabel ??
        (isAllTypesAllowed
          ? t(DialFileManagerI18nKeys.AllTypes)
          : hasTypeConstraint
            ? mimeTypesToExtensionLabels(allowedTypes ?? [])
            : undefined);

      const maxSize =
        hasSizeConstraint && maxSelectableFileSize != null
          ? formatFileSize(maxSelectableFileSize)
          : undefined;

      if (typeLabel != null && maxSize != null) {
        parts.push(
          t(DialFileManagerI18nKeys.MaxSizeSupportedTypes, {
            maxSize,
            allowedExtensions: typeLabel,
          }),
        );
      } else if (maxSize != null) {
        parts.push(t(DialFileManagerI18nKeys.MaxSizeOnly, { maxSize }));
      } else if (typeLabel != null) {
        parts.push(typeLabel);
      }
    }

    if (hasCountConstraint) {
      parts.push(
        t(DialFileManagerI18nKeys.UpToFiles, {
          count: maximumAttachmentsAmount,
        }),
      );
    }

    return `${parts.join('. ')}.`;
  }, [
    allowedTypes,
    maxSelectableFileSize,
    maximumAttachmentsAmount,
    allowedTypesLabel,
    t,
  ]);

  const unsupportedFileTypeTooltip = useMemo(() => {
    if (allowedTypes == null || allowedTypes.length === 0) {
      return undefined;
    }
    const areAllTypesAllowed = allowedTypes.some(
      (type) => type === '*' || type === '*/*',
    );
    if (areAllTypesAllowed) {
      return undefined;
    }
    const allowedExtensions =
      allowedTypesLabel ?? mimeTypesToAttachmentExtensionLabels(allowedTypes);
    return t(DialFileManagerI18nKeys.UnsupportedFileTypeTooltip, {
      allowedExtensions,
    });
  }, [allowedTypes, allowedTypesLabel, t]);

  const allowedFileTypes = useMemo(
    () => mimeTypesToDialFileAcceptTypes(allowedTypes),
    [allowedTypes],
  );

  const resolveFolderPath = useCallback(
    (file: DialFile): string | null => {
      const source = file.url ?? file.id ?? '';
      if (!source) return null;
      const dialPath = source.startsWith('files/')
        ? source
        : `files/${file.bucket ?? bucket}/${source.replace(/^\/+/, '')}`;
      /*
       * Strip any `../`/`./` segments before the path is forwarded to DIAL Core —
       * the BFF is the trust boundary, but this guards against a compromised response.
       */
      const normalizedDialPath = dialPath
        .split('/')
        .filter((segment) => segment !== '..' && segment !== '.')
        .join('/');
      return normalizedDialPath.endsWith('/')
        ? normalizedDialPath
        : `${normalizedDialPath}/`;
    },
    [bucket],
  );

  const getUploadProgressText = useCallback(
    (done: number, total: number) =>
      t(DialFileManagerI18nKeys.UploadProgressSummary, { done, total }),
    [t],
  );

  const renameValidationMessages = useMemo(
    () => ({
      emptyName: t(DialFileManagerI18nKeys.RenameNameEmpty),
      duplicateName: t(DialFileManagerI18nKeys.RenameDuplicateName),
    }),
    [t],
  );

  const conflictResolutionPopupOptions = useMemo(
    () => ({
      singleFileTitle: t(DialFileManagerI18nKeys.ConflictSingleTitle),
      multipleFilesTitle: t(DialFileManagerI18nKeys.ConflictMultipleTitle),
      actionLabels: {
        replace: t(DialFileManagerI18nKeys.ConflictReplace),
        duplicate: t(ButtonsI18nKeys.Duplicate),
        cancel: t(ButtonsI18nKeys.Cancel),
      },
      strategyLabels: {
        replaceAll: t(DialFileManagerI18nKeys.ConflictReplaceAll),
        duplicateAll: t(DialFileManagerI18nKeys.ConflictDuplicateAll),
        decideForEach: t(DialFileManagerI18nKeys.ConflictDecideForEach),
      },
      confirmLabel: t(ButtonsI18nKeys.Confirm),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
    }),
    [t],
  );

  const emptyStateByTab = useMemo(
    () => ({
      [DialFileManagerTabs.MyFiles]: {
        title: t(DialFileManagerI18nKeys.MyFilesEmptyStateTitle),
        description: t(DialFileManagerI18nKeys.MyFilesEmptyStateDescription),
      },
      [DialFileManagerTabs.Shared]: {
        title: t(DialFileManagerI18nKeys.SharedEmptyStateTitle),
        description: t(DialFileManagerI18nKeys.SharedEmptyStateDescription),
      },
      [DialFileManagerTabs.Organization]: {
        title: t(DialFileManagerI18nKeys.OrganizationEmptyStateTitle),
        description: t(
          DialFileManagerI18nKeys.OrganizationEmptyStateDescription,
        ),
      },
      [DialFileManagerTabs.Review]: {
        title: emptyTitle,
        description: emptyDescription,
      },
    }),
    [t, emptyTitle, emptyDescription],
  );

  const treeHeaderByTab = useMemo(
    () => ({
      [DialFileManagerTabs.MyFiles]: t(
        DialFileManagerI18nKeys.MyFilesTreeHeader,
      ),
      [DialFileManagerTabs.Shared]: t(DialFileManagerI18nKeys.TabShared),
      [DialFileManagerTabs.Organization]: t(BasicI18nKeys.Organization),
      [DialFileManagerTabs.Review]: '',
    }),
    [t],
  );

  const labels: FileManagerAttachModalLabels = useMemo(
    () => ({
      title,
      attachLabel,
      headerDescription,
      errorMessage,
      retryLabel,
      hiddenFilesLabel,
      showHiddenFilesLabel,
      hideHiddenFilesLabel,
      getSelectionLabel,
      uploadFilesLabel,
      uploadArchiveAction: t(DialFileManagerI18nKeys.UploadArchiveAction),
      newFolderLabel,
      downloadLabel,
      downloadingLabel,
      deleteLabel,
      deletingLabel,
      renameLabel: t(ButtonsI18nKeys.Rename),
      renamingLabel: t(DialFileManagerI18nKeys.RenamingLabel),
      copyLabel: t(DialFileManagerI18nKeys.CopyAction),
      moveLabel: t(DialFileManagerI18nKeys.MoveAction),
      duplicateLabel: t(ButtonsI18nKeys.Duplicate),
      addFolderLabel: t(DialFileManagerI18nKeys.FolderPickerAddFolderLabel),
      hiddenFilesSwitcherLabel: t(DialFileManagerI18nKeys.HiddenFiles),
      getCopyHeader: (count, name) =>
        count === 1
          ? t(DialFileManagerI18nKeys.CopyHeaderSingle, { name })
          : t(DialFileManagerI18nKeys.CopyHeaderMultiple, { count }),
      getMoveHeader: (count, name) =>
        count === 1
          ? t(DialFileManagerI18nKeys.MoveHeaderSingle, { name })
          : t(DialFileManagerI18nKeys.MoveHeaderMultiple, { count }),
      moveSourceDisabledTooltip: t(
        DialFileManagerI18nKeys.MoveSourceDisabledTooltip,
      ),
      folderPickerLoadingTooltip: t(
        DialFileManagerI18nKeys.FolderPickerLoadingTooltip,
      ),
      folderPickerEmptyStateTitle: t(
        DialFileManagerI18nKeys.FolderPickerEmptyStateTitle,
      ),
      folderPickerEmptyStateDescription: t(
        DialFileManagerI18nKeys.FolderPickerEmptyStateDescription,
      ),
      copyingLabel: t(DialFileManagerI18nKeys.CopyingLabel),
      movingLabel: t(DialFileManagerI18nKeys.MovingLabel),
      operationLoaderCopyTitle: t(
        DialFileManagerI18nKeys.OperationLoaderCopyTitle,
      ),
      operationLoaderMoveTitle: t(
        DialFileManagerI18nKeys.OperationLoaderMoveTitle,
      ),
      operationLoaderCancelLabel: t(ButtonsI18nKeys.Cancel),
      deleteConfirmTitle,
      deleteConfirmBody,
      deleteConfirmLabel,
      deleteCancelLabel,
      uploadProgressTitle,
      cancelLabel,
      getUploadProgressText,
      searchEmptyStateTitle: t(BasicI18nKeys.NoResults),
      folderEmptyStateTitle: t(DialFileManagerI18nKeys.Empty),
      forbiddenSymbolsTooltip: t(
        DialFileManagerI18nKeys.ForbiddenSymbolsTooltip,
        { notAllowedSymbols: NOT_ALLOWED_SYMBOLS },
      ),
      emptyStateByTab,
      treeHeaderByTab,
      renameValidationMessages,
      conflictResolutionPopupOptions,
      unshareLabel: t(DialFileManagerI18nKeys.UnshareAction),
      unsharingLabel: t(DialFileManagerI18nKeys.UnsharingLabel),
      removeAccessLabel: t(DialFileManagerI18nKeys.RemoveAccessAction),
      removingAccessLabel: t(DialFileManagerI18nKeys.RemovingAccessLabel),
      infoLabel: t(DialFileManagerI18nKeys.InfoAction),
      metadataHeader: t(DialFileManagerI18nKeys.MetadataHeader),
      metadataNameLabel: t(DialFileManagerI18nKeys.MetadataNameLabel),
      metadataPathLabel: t(DialFileManagerI18nKeys.MetadataPathLabel),
      metadataModifiedDateLabel: t(
        DialFileManagerI18nKeys.MetadataModifiedDateLabel,
      ),
      metadataSizeLabel: t(DialFileManagerI18nKeys.MetadataSizeLabel),
      metadataAuthorLabel: t(DialFileManagerI18nKeys.MetadataAuthorLabel),
    }),
    [
      title,
      attachLabel,
      headerDescription,
      errorMessage,
      retryLabel,
      hiddenFilesLabel,
      showHiddenFilesLabel,
      hideHiddenFilesLabel,
      getSelectionLabel,
      uploadFilesLabel,
      newFolderLabel,
      downloadLabel,
      downloadingLabel,
      deleteLabel,
      deletingLabel,
      deleteConfirmTitle,
      deleteConfirmBody,
      deleteConfirmLabel,
      deleteCancelLabel,
      uploadProgressTitle,
      cancelLabel,
      getUploadProgressText,
      emptyStateByTab,
      treeHeaderByTab,
      renameValidationMessages,
      conflictResolutionPopupOptions,
      t,
    ],
  );

  return (
    <FileManagerAttachModal
      isOpen={isOpen}
      onClose={onClose}
      onAttach={onAttach}
      onSkippedUnsupportedFiles={handleSkippedUnsupportedFiles}
      onCountLimitExceeded={handleCountLimitExceeded}
      controller={hookResult}
      isAnyOperationInProgress={isAnyOperationInProgress}
      activeTab={activeTab}
      tabs={tabs}
      onTabChange={handleTabChange}
      labels={labels}
      variant={DialFileManagerVariant.Attach}
      actionProfile={DialFileManagerActionProfile.Attach}
      selectedPaths={selectedPaths}
      onSelectedPathsChange={handleSelectedPathsChange}
      resolveFolderPath={resolveFolderPath}
      isFileTypeAllowed={isFileTypeAllowed}
      maxSelectableFileSize={maxSelectableFileSize}
      maximumAttachmentsAmount={maximumAttachmentsAmount}
      existingAttachmentsAmount={existingAttachmentsAmount}
      isRowSelectable={isRowSelectable}
      getDisabledTooltip={getDisabledTooltip}
      unsupportedFileTypeTooltip={unsupportedFileTypeTooltip}
      allowedFileTypes={allowedFileTypes}
      autoSelectUploadedItems={autoSelectUploadedItems}
    />
  );
};

export default memo(DialFileManagerModal);
