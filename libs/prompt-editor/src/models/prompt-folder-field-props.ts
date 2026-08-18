import type {
  PromptEditorFolder,
  PromptEditorLabels,
  PromptFolderActions,
} from './prompt-editor-props';

/** Props for `PromptFolderField`. */
export interface PromptFolderFieldProps {
  /** Currently selected folder path. The empty string means the root folder. */
  value: string;
  /** Folders offered by the picker, excluding the root. */
  folders: PromptEditorFolder[];
  /** Message shown under the picker itself. */
  error?: string;
  /** Message shown under the folder-name field of the create/rename sub-form. */
  nameError?: string;
  /** Folder mutations. Omit to render the picker without create/rename/delete controls. */
  actions?: PromptFolderActions;
  /** Whether the selected folder is read-only. */
  disabled?: boolean;
  /** Text overrides, shared with `PromptEditor`. */
  labels?: PromptEditorLabels;
  /** Class applied to helper and confirmation text. Defaults to `'dial-small-text'`. */
  helperTextClassName?: string;
  /** Called with the newly selected folder path (the empty string for root). */
  onChange: (folderId: string) => void;
}
