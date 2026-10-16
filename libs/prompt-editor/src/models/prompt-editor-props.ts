import type {
  TextRefinementCallback,
  TextRefinementLabels,
} from '@epam/ai-dial-chat-shared';
import type { EditorThemes } from '@epam/ai-dial-ui-kit';

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
export interface PromptEditorLabels extends TextRefinementLabels {
  /** Heading shown in create mode. Defaults to `'Create prompt'`. */
  createTitle?: string;
  /** Heading shown in edit mode. Defaults to `'Edit prompt'`. */
  editTitle?: string;
  /** Accessible label of the header back button. Defaults to `'Back to prompts'`. */
  backButtonAriaLabel?: string;
  /** Name field label. Defaults to `'Name'`. */
  nameLabel?: string;
  /** Name field placeholder. Defaults to `'Prompt name'`. */
  namePlaceholder?: string;
  /** Description field label. Defaults to `'Description'`. */
  descriptionLabel?: string;
  /** Description field placeholder. Defaults to `'What this prompt is for'`. */
  descriptionPlaceholder?: string;
  /** Content field label. Defaults to `'Instructions'`. */
  contentLabel?: string;
  /** Content field placeholder. Defaults to `'Write the prompt instructions'`. */
  contentPlaceholder?: string;
  /** Folder picker label, used by the standalone `PromptFolderField`. Defaults to `'Folder'`. */
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
  /** Primary button label in create mode. Defaults to `'Create'`. */
  createLabel?: string;
  /** Primary button label in edit mode. Defaults to `'Save'`. */
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
  /** Accessible label of the markdown editor loading spinner. Defaults to `'Loading prompt editor'`. */
  contentLoadingAriaLabel?: string;
  /** Builds the characters-remaining announcement. Defaults to `` `${count} characters remaining` ``. */
  charactersRemaining?: (count: number) => string;
  /** Title of the confirmation shown when leaving with unsaved changes. Defaults to `'Discard unsaved changes?'`. */
  discardTitle?: string;
  /** Message of the unsaved-changes confirmation. Defaults to `'You have unsaved changes. Leaving now will discard them.'`. */
  discardMessage?: string;
  /** Confirm button label of the unsaved-changes confirmation. Defaults to `'Discard'`. */
  discardConfirmLabel?: string;
  /** Cancel button label of the unsaved-changes confirmation. Defaults to `'Keep editing'`. */
  discardCancelLabel?: string;
}

/** Typography class overrides for `PromptEditor`. */
export interface PromptEditorTypography {
  /** Class applied to the prompt editor label. Defaults to `'dial-tiny-semi-text'`. */
  contentLabelClassName?: string;
  /** Class applied to helper, error, and confirmation text. Defaults to `'dial-small-text'`. */
  helperTextClassName?: string;
}

/** Color overrides for `PromptEditor`. */
export interface PromptEditorColors {
  /** Prompt validation error text. Fallback: `--text-error`. */
  contentErrorText?: string;
  /** Border of the instructions editor while it has an error. Fallback: `--stroke-error`. */
  contentInvalidBorder?: string;
}

/** Grouped style overrides for `PromptEditor`. */
export interface PromptEditorStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: PromptEditorColors;
  /** Typography class overrides. */
  typography?: PromptEditorTypography;
}

/** Props for `PromptEditor`. */
export interface PromptEditorProps {
  /** Whether the form edits an existing prompt (changes the heading and the primary button label). Defaults to `false`. */
  isEditMode?: boolean;
  /**
   * Values to seed the fields with. Changing this object's identity re-seeds
   * the form, so hosts that load asynchronously should memoise it and only
   * produce a new object once the data has arrived.
   */
  initialValues?: Partial<PromptEditorValues>;
  /** Whether the prompt being edited is still loading. Defaults to `false`. */
  isLoading?: boolean;
  /** Whether loading the prompt failed; renders an error state with a retry instead of the form. Defaults to `false`. */
  hasLoadError?: boolean;
  /** Whether a save is in flight; disables submission. Defaults to `false`. */
  isSaving?: boolean;
  /** Inline validation messages to render under the fields. */
  errors?: PromptEditorErrors;
  /** Hard limit on the description, shown as a `length/limit` counter under it and used for the characters-remaining announcement. Defaults to `2000`. */
  descriptionMaxLength?: number;
  /** Maximum content length used for the characters-remaining announcement. Defaults to `50000`. */
  contentMaxLength?: number;
  /** How close to a limit the announcement starts, in characters. Defaults to `10`. */
  counterAnnounceThreshold?: number;
  /** Called with the current values when the form is submitted. */
  onSubmit: (values: PromptEditorValues) => void;
  /** Called with each edited field and its new value, e.g. to validate while the user types. */
  onFieldChange?: (field: keyof PromptEditorValues, value: string) => void;
  /** Called when the form is dismissed without saving; with unsaved edits and no `onDirtyChange`, only after the user confirms discarding them. */
  onCancel: () => void;
  /** Called when the header back button is activated, behind the same unsaved-changes confirmation as `onCancel`. Defaults to `onCancel`. */
  onBack?: () => void;
  /**
   * Called with whether the form holds unsaved edits, on mount and whenever that changes.
   * Providing it hands unsaved-changes handling to the host: the built-in discard confirmation
   * and unload warning are turned off, and Back/Cancel call `onBack`/`onCancel` directly.
   */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Called when the retry button in the load-error state is activated. */
  onRetry?: () => void;
  /** Optional Description rewrite callback; omission hides the Refine with AI action. */
  onRefineDescription?: TextRefinementCallback;
  /** Optional Instructions rewrite callback; omission hides the Refine with AI action. */
  onRefineInstructions?: TextRefinementCallback;
  /** Text overrides. */
  labels?: PromptEditorLabels;
  /** Theme applied to the prompt markdown editor. Defaults to the editor's own default (`EditorThemes.light`). */
  markdownEditorTheme?: EditorThemes;
  /** Style overrides. */
  styles?: PromptEditorStyles;
}
