import type { AttachResult } from '@epam/ai-dial-chat-shared';
import type { ComponentType, ReactNode } from 'react';

/** Pre-translated labels for `AvatarPickerModal`, supplied by the host app. */
export interface AvatarPickerModalLabels {
  /** Modal title. */
  title: string;
  /** Label for the confirm/attach button. */
  attachLabel: string;
  /** Title shown when the current folder has no files. */
  emptyTitle: string;
  /** Description shown when the current folder has no files. */
  emptyDescription: string;
  /** Message shown when file listing fails. */
  errorMessage: string;
  /** Label for the retry-after-error button. */
  retryLabel: string;
  /** Label for the hidden-files row/toggle. */
  hiddenFilesLabel: string;
  /** Label for the action that reveals hidden files. */
  showHiddenFilesLabel: string;
  /** Label for the action that hides hidden files again. */
  hideHiddenFilesLabel: string;
  /** Returns the selection-count summary text for the given count. */
  getSelectionLabel: (count: number) => string;
  /** Label for the upload-files action. */
  uploadFilesLabel: string;
  /** Label for the new-folder action. */
  newFolderLabel: string;
  /** Label for the download action. */
  downloadLabel: string;
  /** Label shown while a download is in progress. */
  downloadingLabel: string;
  /** Label for the delete action. */
  deleteLabel: string;
  /** Label shown while a delete is in progress. */
  deletingLabel: string;
  /** Delete-confirmation title used when deleting a single item. */
  deleteConfirmTitleSingle: string;
  /** Delete-confirmation title used when deleting multiple items. */
  deleteConfirmTitleMultiple: string;
  /** Confirmation body text used when deleting a single item, followed by its name. */
  deleteConfirmSingleText: string;
  /** Confirmation body text used when deleting multiple items, followed by the count. */
  deleteConfirmMultipleText: string;
  /** Unit label appended after the count in the multiple-item confirmation (e.g. `'items'`). */
  deleteConfirmItemsLabel: string;
  /** Label for the delete-confirmation confirm button. */
  deleteConfirmLabel: string;
  /** Label for the delete-confirmation cancel button. */
  deleteCancelLabel: string;
  /** Title shown while an upload is in progress. */
  uploadProgressTitle: string;
  /** Label for the cancel button. */
  cancelLabel: string;
}

/**
 * Props of the host-provided DIAL file manager modal that `AvatarPickerModal`
 * renders through `FileManagerModal`. A host component satisfies this shape by
 * accepting these props (e.g. one built on `@epam/ai-dial-react-file-manager`).
 */
export interface AvatarPickerFileManagerModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Called when the modal should close without a selection. */
  onClose: () => void;
  /** Called with the picked file(s) once the user confirms. */
  onAttach: (result: AttachResult) => void;
  /** Storage bucket to browse. */
  bucket: string;
  /** Modal title. */
  title: string;
  /** Label for the confirm/attach button. */
  attachLabel: string;
  /** Title shown when the current folder has no files. */
  emptyTitle: string;
  /** Description shown when the current folder has no files. */
  emptyDescription: string;
  /** Message shown when file listing fails. */
  errorMessage: string;
  /** Label for the retry-after-error button. */
  retryLabel: string;
  /** Label for the hidden-files row/toggle. */
  hiddenFilesLabel: string;
  /** Label for the action that reveals hidden files. */
  showHiddenFilesLabel: string;
  /** Label for the action that hides hidden files again. */
  hideHiddenFilesLabel: string;
  /** Returns the selection-count summary text for the given count. */
  getSelectionLabel: (count: number) => string;
  /** Label for the upload-files action. */
  uploadFilesLabel: string;
  /** Label for the new-folder action. */
  newFolderLabel: string;
  /** Label for the download action. */
  downloadLabel: string;
  /** Label shown while a download is in progress. */
  downloadingLabel: string;
  /** Label for the delete action. */
  deleteLabel: string;
  /** Label shown while a delete is in progress. */
  deletingLabel: string;
  /** Renders the delete-confirmation title for the given item names. */
  deleteConfirmTitle: (names: string[]) => ReactNode;
  /** Renders the delete-confirmation body for the given item names. */
  deleteConfirmBody: (names: string[]) => ReactNode;
  /** Label for the delete-confirmation confirm button. */
  deleteConfirmLabel: string;
  /** Label for the delete-confirmation cancel button. */
  deleteCancelLabel: string;
  /** Title shown while an upload is in progress. */
  uploadProgressTitle: string;
  /** Label for the cancel button. */
  cancelLabel: string;
  /** MIME types selectable in the modal. Unset means no type restriction. */
  allowedTypes?: string[];
  /** Maximum size, in bytes, of a selectable file. */
  maxSelectableFileSize?: number;
  /** Maximum number of items that can be selected at once. */
  maximumAttachmentsAmount?: number;
  /** Whether folders can be selected. */
  canAttachFolders?: boolean;
}

/** Props accepted by the `AvatarPickerModal` component. */
export interface AvatarPickerModalProps {
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Called when the modal is dismissed, with or without a selection. */
  onClose: () => void;
  /**
   * Called with the picked file once the user confirms a single-image
   * selection. The host resolves the file to a DIAL resource URL (and calls
   * `onClose`) — this lib never resolves storage identifiers itself.
   */
  onAttach: (result: AttachResult) => void;
  /** Storage bucket to browse, resolved by the host from the current user. */
  bucket: string;
  /** The host's own DIAL file manager modal component, rendered for the actual picking UI. */
  FileManagerModal: ComponentType<AvatarPickerFileManagerModalProps>;
  /** MIME types selectable in the modal (e.g. PNG/JPG/SVG). */
  allowedMimeTypes: string[];
  /** Maximum size, in bytes, of a selectable avatar file. */
  maxFileSizeBytes: number;
  /** Pre-translated labels for the modal. */
  labels: AvatarPickerModalLabels;
}
