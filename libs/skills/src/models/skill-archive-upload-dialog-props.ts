/** Labels for {@link SkillArchiveUploadDialogProps}; each has an English default. */
export interface SkillArchiveUploadDialogLabels {
  /** Dialog header. Defaults to `'Upload skill'`. */
  dialogTitle?: string;
  /** Drop-zone label shown on desktop widths. Defaults to `'Drag and drop it or click here to upload'`. */
  dropZoneLabel?: string;
  /** Drop-zone label shown on mobile widths. Defaults to `'Click here to upload'`. */
  dropZoneMobileLabel?: string;
  /** Sentence describing accepted formats, shown under the drop zone. Defaults to `'File formats .zip and SKILL.md'`. */
  formatsLabel?: string;
  /** Accessible name for the native file input. Defaults to `'Upload a skill ZIP archive or a SKILL.md file'`. */
  fileInputAriaLabel?: string;
  /** Accessible name for the dialog's close button. Defaults to `'Close'`. */
  closeAriaLabel?: string;
}

/** Props for {@link SkillArchiveUploadDialog}. */
export interface SkillArchiveUploadDialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Rejection message rendered under the drop area; omit when nothing was rejected. */
  errorText?: string;
  /** `accept` value forwarded to the drop zone/native file input. Defaults to `'.zip,.md'`. */
  accept?: string;
  /** Labels rendered by the dialog; each falls back to an English default. */
  labels?: SkillArchiveUploadDialogLabels;
  /** Called on Escape, the close button, or an outside click. */
  onClose: () => void;
  /** Called with the picked or dropped files that `accept` allowed through. */
  onFilesSelected: (files: File[]) => void;
  /** Called when a drop carried files that `accept` excluded. */
  onFilesRejected: () => void;
}
