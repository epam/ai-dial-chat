/** One selectable folder in the prompt editor's folder picker. */
export interface PromptEditorFolder {
  /** Folder path, used as the option's value. The empty string is never listed — the root option is synthesised. */
  id: string;
  /** Display name shown in the picker. */
  name: string;
}

/** The prompt fields the editor form holds. */
export interface PromptEditorValues {
  /** Prompt name. */
  name: string;
  /** Optional short description. */
  description: string;
  /** The prompt body. */
  content: string;
  /** Folder the prompt belongs to. The empty string means the root folder. */
  folderId: string;
}

/**
 * Inline validation messages, keyed by field. Resolved by the host, which owns
 * the storage contract the values must satisfy.
 */
export interface PromptEditorErrors {
  /** Message shown under the name field. */
  name?: string;
  /** Message shown under the description field. */
  description?: string;
  /** Message shown under the content field. */
  content?: string;
  /** Message shown under the folder picker. */
  folder?: string;
}

/** Folder mutations the host performs on the editor's behalf. */
export interface PromptFolderActions {
  /** Creates a folder; resolve with its new path so the picker can select it. `parentId` is absent for a root-level folder. */
  onCreateFolder: (name: string, parentId?: string) => Promise<string | void>;
  /** Renames a folder; resolve with its new path so the picker can follow it. */
  onRenameFolder: (folderId: string, name: string) => Promise<string | void>;
  /** Deletes a folder and everything under it. */
  onDeleteFolder: (folderId: string) => Promise<void>;
  /** Validates a folder name before any mutation is dispatched; return a message to block it. */
  onValidateFolderName?: (name: string) => string | undefined;
}

/** Text overrides for `PromptEditor`. Every field has an English default. */
export interface PromptEditorLabels {
  /** Heading shown in create mode. Defaults to `'Create prompt'`. */
  createTitle?: string;
  /** Heading shown in edit mode. Defaults to `'Edit prompt'`. */
  editTitle?: string;
  /** Name field label. Defaults to `'Name'`. */
  nameLabel?: string;
  /** Name field placeholder. Defaults to `'Prompt name'`. */
  namePlaceholder?: string;
  /** Description field label. Defaults to `'Description'`. */
  descriptionLabel?: string;
  /** Description field placeholder. Defaults to `'What this prompt is for'`. */
  descriptionPlaceholder?: string;
  /** Content field label. Defaults to `'Prompt'`. */
  contentLabel?: string;
  /** Content field placeholder. Defaults to `'Write the prompt text'`. */
  contentPlaceholder?: string;
  /** Folder picker label. Defaults to `'Folder'`. */
  folderLabel?: string;
  /** Label of the root option in the folder picker. Defaults to `'Root'`. */
  folderRootOption?: string;
  /** Text shown when there are no folders yet. Defaults to `'No folders yet'`. */
  folderEmptyState?: string;
  /** Accessible label of the create-folder button. Defaults to `'Create folder'`. */
  folderCreateLabel?: string;
  /** Accessible label of the rename-folder button. Defaults to `'Rename folder'`. */
  folderRenameLabel?: string;
  /** Accessible label of the delete-folder button. Defaults to `'Delete folder'`. */
  folderDeleteLabel?: string;
  /** Label of the folder-name field in the create/rename sub-form. Defaults to `'Folder name'`. */
  folderNameLabel?: string;
  /** Title of the delete-folder confirmation. Defaults to `'Delete folder'`. */
  folderDeleteConfirmTitle?: string;
  /** Builds the delete-folder confirmation message. Defaults to a sentence naming the folder. */
  folderDeleteConfirmMessage?: (folderId: string) => string;
  /** Save button label. Defaults to `'Save'`. */
  saveLabel?: string;
  /** Cancel button label. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Retry button label shown in the load-error state. Defaults to `'Retry'`. */
  retryLabel?: string;
  /** Message shown when the prompt could not be loaded. Defaults to `"Couldn't load this prompt. Please try again."`. */
  loadErrorMessage?: string;
  /** Status announced while a save is in flight. Defaults to `'Saving'`. */
  savingStatusLabel?: string;
  /** Accessible label of the loading spinner. Defaults to `'Loading prompt'`. */
  loadingAriaLabel?: string;
  /** Builds the characters-remaining announcement. Defaults to `` `${count} characters remaining` ``. */
  charactersRemaining?: (count: number) => string;
}

/** Typography class overrides for `PromptEditor`. */
export interface PromptEditorTypography {
  /** Class applied to the heading. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** Class applied to helper, error, and confirmation text. Defaults to `'dial-small-text'`. */
  helperTextClassName?: string;
}

/** Grouped style overrides for `PromptEditor`. */
export interface PromptEditorStyles {
  /** Typography class overrides. */
  typography?: PromptEditorTypography;
}

/** Props for `PromptEditor`. */
export interface PromptEditorProps {
  /** Whether the form edits an existing prompt (changes the heading only). Defaults to `false`. */
  isEditMode?: boolean;
  /**
   * Values to seed the fields with. Changing this object's identity re-seeds
   * the form, so hosts that load asynchronously should memoise it and only
   * produce a new object once the data has arrived.
   */
  initialValues?: Partial<PromptEditorValues>;
  /** Folders offered by the picker, excluding the root. */
  folders: PromptEditorFolder[];
  /** Whether the prompt being edited is still loading. Defaults to `false`. */
  isLoading?: boolean;
  /** Whether loading the prompt failed; renders an error state with a retry instead of the form. Defaults to `false`. */
  hasLoadError?: boolean;
  /** Whether a save is in flight; disables submission. Defaults to `false`. */
  isSaving?: boolean;
  /** Inline validation messages to render under the fields. */
  errors?: PromptEditorErrors;
  /** Maximum description length used for the characters-remaining announcement. Defaults to `2000`. */
  descriptionMaxLength?: number;
  /** Maximum content length used for the characters-remaining announcement. Defaults to `50000`. */
  contentMaxLength?: number;
  /** How close to a limit the announcement starts, in characters. Defaults to `10`. */
  counterAnnounceThreshold?: number;
  /** Called with the current values when the form is submitted. */
  onSubmit: (values: PromptEditorValues) => void;
  /** Called when the form is dismissed without saving. */
  onCancel: () => void;
  /** Called when the retry button in the load-error state is activated. */
  onRetry?: () => void;
  /** Folder mutations. Omit to render the picker without create/rename/delete controls. */
  folderActions?: PromptFolderActions;
  /** Inline message shown under the folder-name field of the create/rename sub-form. */
  folderNameError?: string;
  /** Text overrides. */
  labels?: PromptEditorLabels;
  /** Style overrides. */
  styles?: PromptEditorStyles;
}
