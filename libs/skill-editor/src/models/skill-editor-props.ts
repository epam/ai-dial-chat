import type { SkillFileNodeKind } from '../types/skill-file-node-kind';

/**
 * One supporting file or folder in the skill's file tree. The mandatory root
 * `SKILL.md` manifest node is synthesised internally by `SkillEditor` and is
 * never part of this list.
 */
export interface SkillFileTreeNode {
  /** Relative path from the skill root, using `/` separators. */
  path: string;
  /** Display name — the final path segment. */
  name: string;
  /** Whether this node is a file or a folder. */
  kind: SkillFileNodeKind;
}

/** The skill fields the editor form holds. */
export interface SkillEditorValues {
  /** Skill name, as typed by the user (host normalizes it on submit). */
  name: string;
  /** Short description of what the skill does. */
  description: string;
  /** The skill's instructions body (Markdown). */
  instructions: string;
}

/**
 * Inline validation messages, keyed by field. Resolved by the host, which owns
 * the DIAL naming/storage contract the values must satisfy.
 */
export interface SkillEditorErrors {
  /** Message shown under the Name field. */
  name?: string;
  /** Message shown under the Description field. */
  description?: string;
  /** Message shown under the Instructions editor. */
  instructions?: string;
}

/**
 * Host-owned operations on the in-memory supporting-file/folder set. The
 * library calls these when the user interacts with the Add control or removes
 * an entry; it never mutates `files` itself.
 */
export interface SkillEditorFileActions {
  /**
   * Validates a candidate relative path before it is added to the tree
   * (new file, new folder, or an uploaded file's chosen path). Return an
   * error message to block the addition, or `undefined` to accept it.
   */
  validatePath: (path: string) => string | undefined;
  /** Called after a new file or folder node is added to the tree via "New file"/"New folder". */
  onAddNode: (path: string, kind: SkillFileNodeKind) => void;
  /**
   * Called when the user picks a local file to upload as a supporting file.
   * Resolves once the host has read and stored its content; rejects to
   * surface an inline upload error instead of adding the node.
   */
  onUploadFile: (file: File, path: string) => Promise<void>;
  /** Called after the user confirms removing a non-protected node. */
  onRemoveNode: (path: string) => void;
}

/** Text overrides for `SkillEditor`. Every field has an English default. */
export interface SkillEditorLabels {
  /** Files pane heading. Defaults to `'Files'`. */
  filesHeading?: string;
  /** Accessible name of the file tree region. Defaults to `'Skill files'`. */
  filesTreeAriaLabel?: string;
  /** Add-control trigger label. Defaults to `'Add'`. */
  addLabel?: string;
  /** "New file" add action. Defaults to `'New file'`. */
  addFileLabel?: string;
  /** "New folder" add action. Defaults to `'New folder'`. */
  addFolderLabel?: string;
  /** "Upload from device" add action. Defaults to `'Upload from device'`. */
  addUploadLabel?: string;
  /** Label of the new file/folder path input. Defaults to `'Path'`. */
  newPathLabel?: string;
  /** Placeholder for the new file/folder path input. Defaults to `'path/to/file.md'`. */
  newPathPlaceholder?: string;
  /** Accessible label of a node's remove action. Defaults to `'Remove'`. */
  removeLabel?: string;
  /** Title of the remove-confirmation prompt. Defaults to `'Remove file'`. */
  removeConfirmTitle?: string;
  /** Builds the remove-confirmation message for a given path. Defaults to a sentence naming the path. */
  removeConfirmMessage?: (path: string) => string;
  /** Confirm button label in the remove-confirmation prompt. Defaults to `'Remove'`. */
  removeConfirmLabel?: string;
  /** Cancel button label in the remove-confirmation prompt. Defaults to `'Cancel'`. */
  removeCancelLabel?: string;
  /** Collapsed mobile summary label. Defaults to `'Editing file'`. */
  editingFileLabel?: string;
  /** Main-pane heading, given the selected node's name. Defaults to the name itself. */
  selectedFileHeading?: (name: string) => string;
  /** Name field label. Defaults to `'Name'`. */
  nameLabel?: string;
  /** Name field placeholder. Defaults to `'good-morning-breakfast'`. */
  namePlaceholder?: string;
  /** Name field helper text. Defaults to `"Lowercase letters and hyphens only, no spaces. We'll reformat automatically if needed."`. */
  nameCaption?: string;
  /** Description field label. Defaults to `'Description'`. */
  descriptionLabel?: string;
  /** Description field placeholder. Defaults to `'What this skill does and when to use it'`. */
  descriptionPlaceholder?: string;
  /** Instructions editor label. Defaults to `'Instructions'`. */
  instructionsLabel?: string;
  /** Instructions editor placeholder. Defaults to `'Write the skill instructions in Markdown'`. */
  instructionsPlaceholder?: string;
  /** Create button label. Defaults to `'Create'`. */
  createLabel?: string;
  /** Cancel button label. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Retry button label shown in the load-error state. Defaults to `'Retry'`. */
  retryLabel?: string;
  /** Message shown when the skill could not be loaded. Defaults to `"Couldn't load this skill. Please try again."`. */
  loadErrorMessage?: string;
  /** Status announced while a save is in flight. Defaults to `'Saving'`. */
  savingStatusLabel?: string;
  /** Accessible label of the loading spinner. Defaults to `'Loading skill'`. */
  loadingAriaLabel?: string;
  /** Note shown in the main pane when a supporting file (not `SKILL.md` or a folder) is selected. Defaults to a sentence explaining content isn't editable here. */
  supportingFileNote?: string;
}

/** Typography class overrides for `SkillEditor`. */
export interface SkillEditorTypography {
  /** Class applied to the heading. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** Class applied to helper, error, and confirmation text. Defaults to `'dial-small-text'`. */
  helperTextClassName?: string;
}

/** Grouped style overrides for `SkillEditor`. */
export interface SkillEditorStyles {
  /** Typography class overrides. */
  typography?: SkillEditorTypography;
}

/** Props for `SkillEditor`. */
export interface SkillEditorProps {
  /**
   * Values to seed the fields with. Changing this object's identity re-seeds
   * the form, so hosts that load asynchronously should memoise it and only
   * produce a new object once the data has arrived.
   */
  initialValues?: Partial<SkillEditorValues>;
  /** Supporting files/folders, excluding the always-present root `SKILL.md` node, which the component synthesises. */
  files: SkillFileTreeNode[];
  /** Currently selected node path. Defaults to `'SKILL.md'` when omitted. */
  selectedPath?: string;
  /** Called when the selected node changes. Omit to let the component manage selection internally. */
  onSelectedPathChange?: (path: string) => void;
  /** Currently expanded folder paths. Omit to let the component manage expansion internally. */
  expandedPaths?: string[];
  /** Called when the set of expanded folder paths changes. */
  onExpandedPathsChange?: (paths: string[]) => void;
  /** Whether the skill being edited is still loading. Defaults to `false`. */
  isLoading?: boolean;
  /** Whether loading the skill failed; renders an error state with a retry instead of the form. Defaults to `false`. */
  hasLoadError?: boolean;
  /** Whether a save is in flight; disables submission. Defaults to `false`. */
  isSubmitting?: boolean;
  /** Inline validation messages to render under the fields. */
  errors?: SkillEditorErrors;
  /** General submit-time error (e.g. a naming conflict or a server error) rendered in a `role="alert"` region. */
  submitError?: string;
  /** File-tree mutation operations. */
  fileActions: SkillEditorFileActions;
  /** Called with the current values when the form is submitted. */
  onSubmit: (values: SkillEditorValues) => void;
  /** Called when the form is dismissed without saving. */
  onCancel: () => void;
  /** Called when the retry button in the load-error state is activated. */
  onRetry?: () => void;
  /** Text overrides. */
  labels?: SkillEditorLabels;
  /** Style overrides. */
  styles?: SkillEditorStyles;
  /** Explicit direction override. Omit to inherit from the ambient `dir` attribute. */
  dir?: 'ltr' | 'rtl';
  /** Theme applied to the Instructions Markdown editor, resolved by the host from its own theme state. Defaults to `'light'`. */
  instructionsEditorTheme?: 'light' | 'dark';
}
