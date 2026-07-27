import type { DialFileManagerTabs } from '@epam/ai-dial-ui-kit';
import { DialFileManager } from '@epam/ai-dial-ui-kit';
import type { ComponentProps, ReactNode } from 'react';

type DialFileManagerComponentProps = ComponentProps<typeof DialFileManager>;

export type ConflictResolutionPopupOptions = NonNullable<
  DialFileManagerComponentProps['conflictResolutionPopupOptions']
>;

export type RenameValidationMessages = NonNullable<
  DialFileManagerComponentProps['renameValidationMessages']
>;

export type DialFileManagerDestinationFolderPopupOptions = NonNullable<
  DialFileManagerComponentProps['destinationFolderPopupOptions']
>;

export interface EmptyStateCopy {
  title: string;
  description: string;
}

/**
 * Pre-translated strings and resolved renderers the shell renders as-is.
 * The shell never calls `useTranslation` — every host (the attach modal
 * today; a future standalone page) resolves these via its own i18n.
 */
export interface DialFileManagerShellLabels {
  errorMessage: string;
  retryLabel: string;
  hiddenFilesLabel: string;
  showHiddenFilesLabel: string;
  hideHiddenFilesLabel: string;
  getSelectionLabel: (count: number) => string;
  uploadFilesLabel: string;
  uploadArchiveAction: string;
  newFolderLabel: string;
  downloadLabel: string;
  downloadingLabel: string;
  deleteLabel: string;
  deletingLabel: string;
  renameLabel: string;
  renamingLabel: string;
  copyLabel: string;
  moveLabel: string;
  duplicateLabel: string;
  addFolderLabel: string;
  hiddenFilesSwitcherLabel: string;
  getCopyHeader: (count: number, name?: string) => string;
  getMoveHeader: (count: number, name?: string) => string;
  moveSourceDisabledTooltip: string;
  folderPickerLoadingTooltip: string;
  folderPickerEmptyStateTitle: string;
  folderPickerEmptyStateDescription: string;
  copyingLabel: string;
  movingLabel: string;
  operationLoaderCopyTitle: string;
  operationLoaderMoveTitle: string;
  operationLoaderCancelLabel: string;
  deleteConfirmTitle: (names: string[]) => ReactNode;
  deleteConfirmBody: (names: string[]) => ReactNode;
  deleteConfirmLabel: string;
  deleteCancelLabel: string;
  uploadProgressTitle: string;
  cancelLabel: string;
  getUploadProgressText: (done: number, total: number) => string;
  searchEmptyStateTitle: string;
  folderEmptyStateTitle: string;
  forbiddenSymbolsTooltip: string;
  emptyStateByTab: Record<DialFileManagerTabs, EmptyStateCopy>;
  treeHeaderByTab: Record<DialFileManagerTabs, string>;
  renameValidationMessages: RenameValidationMessages;
  conflictResolutionPopupOptions: ConflictResolutionPopupOptions;
  shareLabel: string;
  unshareLabel: string;
  unsharingLabel: string;
  removeAccessLabel: string;
  removingAccessLabel: string;
  getShareModalTitle: (name: string) => string;
  shareModalReadPermissionLabel: string;
  shareModalReadWritePermissionLabel: string;
  shareModalCreateLinkButtonLabel: string;
  shareModalCopyLinkButtonLabel: string;
  shareModalLinkCopiedConfirmation: string;
  shareModalCancelLabel: string;
  shareErrorMessage: string;
  infoLabel: string;
  metadataHeader: string;
  metadataNameLabel: string;
  metadataPathLabel: string;
  metadataModifiedDateLabel: string;
  metadataSizeLabel: string;
  metadataAuthorLabel: string;
}
