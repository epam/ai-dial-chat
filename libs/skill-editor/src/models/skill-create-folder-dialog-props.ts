import type { SkillEditorDialogColors } from './skill-editor-dialog-props';

/** Props for `SkillCreateFolderDialog`. */
export interface SkillCreateFolderDialogProps {
  /** Whether the dialog is shown. */
  isOpen: boolean;
  /** Called to close the dialog: Cancel, the close control, Escape, or a created folder. */
  onClose: () => void;
  /** Returns the error for a folder name, or `undefined` when it can be created. */
  validateName: (name: string) => string | undefined;
  /** Creates the folder with an already validated name. */
  onCreate: (name: string) => void;
  /** Dialog title. */
  title: string;
  /** Name field label. */
  nameLabel: string;
  /** Name field placeholder. */
  namePlaceholder: string;
  /** Create button label. */
  createLabel: string;
  /** Cancel button label. */
  cancelLabel: string;
  /** Accessible name of the close control. */
  closeAriaLabel: string;
  /** Color overrides for the mobile sheet footer. */
  dialogColors?: SkillEditorDialogColors;
}
