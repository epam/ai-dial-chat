import type { ReactNode } from 'react';

/** Props for `SkillEditorDialog`. */
export interface SkillEditorDialogProps {
  /** Whether the dialog is shown. */
  isOpen: boolean;
  /** Heading of the dialog, which also names it. */
  title: string;
  /** Accessible name of the close button. */
  closeAriaLabel: string;
  /** Called when the dialog asks to close: the close button, Escape, or a press outside it. */
  onClose: () => void;
  /** Label of the confirming button. */
  confirmLabel: string;
  /** Called when the confirming button is activated. */
  onConfirm: () => void;
  /** Label of the cancelling button. */
  cancelLabel: string;
  /** Called when the cancelling button is activated. */
  onCancel: () => void;
  /** Disables the confirming button. Defaults to `false`. */
  isConfirmDisabled?: boolean;
  /** Shows a spinner in the confirming button while its action runs. Defaults to `false`. */
  isConfirming?: boolean;
  /** Content of the dialog body, which brings its own padding. */
  children: ReactNode;
}
