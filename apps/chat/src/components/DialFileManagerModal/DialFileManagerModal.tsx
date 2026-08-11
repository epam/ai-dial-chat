import {
  isMimeTypeAllowed,
  mimeTypesToExtensionLabels,
} from '@epam/ai-dial-attachment-input';
import {
  DialFileManagerTabs,
  DialFileNodeType,
  useDialFileManagerTabs,
  type DialFile,
  type FileManagerGridRow,
} from '@epam/ai-dial-react-file-manager';
import {
  Popup,
  NOT_ALLOWED_SYMBOLS,
  NOT_ALLOWED_SYMBOLS_REGEXP,
  NotificationVariant,
  PopupSize,
  PrimaryButton,
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
import { useNotification } from '../../context/NotificationContext';
import { useDialFileManager } from '../../hooks/files/useDialFileManager';
import { useDialFileManagerTabConfig } from '../../hooks/files/useDialFileManagerTabConfig';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../../types/file-manager-variant';
import {
  mimeTypesToAttachmentExtensionLabels,
  mimeTypesToDialFileAcceptTypes,
} from '../../utils/attachment-types';
import { isHiddenPath } from '../../utils/file-path';
import { formatFileSize } from '../../utils/string-utils';
import DialFileManagerShell from '../DialFileManagerShell/DialFileManagerShell';
import type { DialFileManagerShellLabels } from '../DialFileManagerShell/types/labels';
import type { AttachResult } from './types/attach-result';

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
  const { showNotification } = useNotification();

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
    handleTabChange,
    tabs: allTabs,
  } = useDialFileManagerTabs(tabLabels, DialFileManagerTabs.MyFiles);

  const rootLabel =
    tabLabels[activeTab] || tabLabels[DialFileManagerTabs.MyFiles];

  const { tabs } = useDialFileManagerTabConfig(
    activeTab,
    handleTabChange,
    allTabs,
  );

  const hookResult = useDialFileManager({
    bucket,
    activeTab,
    rootLabel,
    onNotification: showNotification,
    variant: DialFileManagerVariant.Attach,
    forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP,
  });

  const { items, isLoading, searchResults, isAnyOperationInProgress } =
    hookResult;

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
    () => new Set(),
  );

  const handleSelectedPathsChange = useCallback((paths: Set<string>) => {
    setSelectedPaths(
      new Set(Array.from(paths).filter((path) => !isHiddenPath(path))),
    );
  }, []);

  const handleTabChangeWithReset = useCallback(
    (tab: DialFileManagerTabs) => {
      setSelectedPaths(new Set());
      handleTabChange(tab);
    },
    [handleTabChange],
  );

  const filesByPath = useMemo(() => {
    const result = new Map<string, DialFile>();
    const collect = (nodes: DialFile[]) => {
      nodes.forEach((item) => {
        if (
          item.nodeType === DialFileNodeType.ITEM ||
          item.nodeType === DialFileNodeType.FOLDER
        ) {
          result.set(item.path, item);
          if (item.id) result.set(item.id, item);
        }
        if (item.items) collect(item.items);
      });
    };
    collect(items);
    searchResults?.forEach((file) => {
      result.set(file.path, file);
      if (file.id) result.set(file.id, file);
    });
    return result;
  }, [items, searchResults]);

  const selectedFiles = useMemo(
    () =>
      Array.from(selectedPaths)
        .map((selectedPath) => filesByPath.get(selectedPath))
        .filter((file): file is DialFile => file != null),
    [filesByPath, selectedPaths],
  );

  const handleAttach = useCallback(() => {
    const selectedFolderPaths: string[] = [];
    const selectedFileNodes: DialFile[] = [];

    for (const file of selectedFiles) {
      if (isHiddenPath(file.path)) continue;

      if (file.nodeType === DialFileNodeType.FOLDER) {
        selectedFolderPaths.push(file.path);
      } else {
        selectedFileNodes.push(file);
      }
    }

    const dedupedFolderPaths = selectedFolderPaths.filter(
      (fp) =>
        !selectedFolderPaths.some(
          (other) => other !== fp && fp.startsWith(`${other}/`),
        ),
    );

    const validFiles = selectedFileNodes.filter((file) => {
      if (isHiddenPath(file.path)) return false;
      if (
        allowedTypes != null &&
        allowedTypes.length > 0 &&
        file.contentType != null &&
        !isMimeTypeAllowed(file.contentType, allowedTypes)
      ) {
        return false;
      }
      return true;
    });

    const dedupedFiles = validFiles.filter(
      (file) =>
        !dedupedFolderPaths.some((fp) => file.path.startsWith(`${fp}/`)),
    );

    const skippedCount = selectedFileNodes.length - validFiles.length;
    if (skippedCount > 0) {
      showNotification({
        variant: NotificationVariant.Info,
        message: t(DialFileManagerI18nKeys.UnsupportedFilesDescription),
        title: t(DialFileManagerI18nKeys.UnsupportedFilesSkipped),
      });
    }

    const dialCoreFolderPaths = dedupedFolderPaths.flatMap((virtualPath) => {
      const file = filesByPath.get(virtualPath);
      if (file == null) return [];
      const source = file.url ?? file.id ?? '';
      if (!source) return [];
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
      return [
        normalizedDialPath.endsWith('/')
          ? normalizedDialPath
          : `${normalizedDialPath}/`,
      ];
    });

    const totalCount =
      existingAttachmentsAmount +
      dedupedFiles.length +
      dialCoreFolderPaths.length;
    if (
      maximumAttachmentsAmount != null &&
      maximumAttachmentsAmount > 0 &&
      totalCount > maximumAttachmentsAmount
    ) {
      showNotification({
        variant: NotificationVariant.Error,
        message: t(DialFileManagerI18nKeys.TooManyFilesDescription, {
          count: totalCount,
          limit: maximumAttachmentsAmount,
        }),
        title: t(DialFileManagerI18nKeys.TooManyFilesSelected),
      });
      return;
    }

    onAttach({ files: dedupedFiles, folderPaths: dialCoreFolderPaths });
  }, [
    onAttach,
    selectedFiles,
    allowedTypes,
    maximumAttachmentsAmount,
    existingAttachmentsAmount,
    showNotification,
    t,
    filesByPath,
    bucket,
  ]);

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

  const treeHeaderByTab: Record<DialFileManagerTabs, string> = useMemo(
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

  const labels: DialFileManagerShellLabels = useMemo(
    () => ({
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
    <Popup
      open={isOpen}
      header={
        <div className="flex flex-col gap-1">
          <span>{title}</span>
          {headerDescription != null && (
            <p className="dial-small-text text-start">{headerDescription}</p>
          )}
        </div>
      }
      ariaLabel={title}
      size={PopupSize.Lg}
      className="flex !h-[min(800px,100dvh)] w-full flex-col !bg-layer-sunken"
      onClose={onClose}
      footer={
        <div className="flex justify-end px-6 py-4">
          <PrimaryButton
            label={attachLabel}
            disabled={
              selectedFiles.length === 0 ||
              isLoading ||
              isAnyOperationInProgress
            }
            onClick={handleAttach}
          />
        </div>
      }
    >
      <div className="flex min-h-0 flex-col">
        <DialFileManagerShell
          hookResult={hookResult}
          labels={labels}
          activeTab={activeTab}
          tabs={tabs}
          onTabChange={handleTabChangeWithReset}
          selectedPaths={selectedPaths}
          onSelectedPathsChange={handleSelectedPathsChange}
          variant={DialFileManagerVariant.Attach}
          actionProfile={DialFileManagerActionProfile.Attach}
          autoSelectUploadedItems={autoSelectUploadedItems}
          allowedFileTypes={allowedFileTypes}
          maxSelectableFileSize={maxSelectableFileSize}
          isRowSelectable={isRowSelectable}
          getDisabledTooltip={getDisabledTooltip}
          unsupportedFileTypeTooltip={unsupportedFileTypeTooltip}
        />
      </div>
    </Popup>
  );
};

export default memo(DialFileManagerModal);
