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
  newFolderLabel: string;
  downloadLabel: string;
  downloadingLabel: string;
  deleteLabel: string;
  deletingLabel: string;
  renameLabel: string;
  renamingLabel: string;
  copyLabel: string;
  moveLabel: string;
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
  forbiddenSymbolsTooltip: string;
  emptyStateByTab: Record<DialFileManagerTabs, EmptyStateCopy>;
  treeHeaderByTab: Record<DialFileManagerTabs, string>;
  renameValidationMessages: RenameValidationMessages;
  conflictResolutionPopupOptions: ConflictResolutionPopupOptions;
}
