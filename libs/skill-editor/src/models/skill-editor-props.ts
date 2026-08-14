import type { ReactNode } from 'react';
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
 * Host-owned operations on the in-memory supporting-file set. The library
 * calls these when the user uploads a file from their device or removes an
 * entry; it never mutates `files` itself.
 */
export interface SkillEditorFileActions {
  /**
   * Validates an uploaded file's path before it is added to the tree. Return
   * an error message to block the addition, or `undefined` to accept it.
   */
  validatePath: (path: string) => string | undefined;
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
  /**
   * Label of the control that opens the device file picker to add a
   * supporting file. Defaults to `'Upload from device'`.
   */
  addUploadLabel?: string;
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
  /** Accessible label of the top-level loading spinner shown while `isLoading` is `true`. Defaults to `'Loading skill'`. */
  loadingAriaLabel?: string;
  /** Accessible label of the spinner shown while the Instructions Markdown editor's chunk is loading. Defaults to `'Loading'`. */
  instructionsLoadingAriaLabel?: string;
  /** Note shown in the main pane when a supporting file (not `SKILL.md` or a folder) is selected. Defaults to a sentence explaining content isn't editable here. */
  supportingFileNote?: string;
  /** Label of the "Reload latest" button rendered next to the host-supplied `conflict.message` in the conflict state. Defaults to `'Reload latest'`. */
  reloadLatestLabel?: string;
}

/**
 * Describes a save-time conflict (e.g. a stale ETag) distinct from
 * `submitError` (an unrecoverable submit failure). When present, `SkillEditor`
 * renders `conflict.message` plus a "Reload latest" control that calls
 * `onReloadLatest` — the control never clears any field itself.
 */
export interface SkillEditorConflict {
  /** Host-resolved, already-translated conflict message. */
  message: string;
}

/** CSS custom-property color overrides for `SkillEditor`. */
export interface SkillEditorColors {
  /** Color of the "Files" and selected-file section headings. Defaults to `--text-primary`. */
  title?: string;
  /** Color of the hand-rendered Instructions field label. Defaults to `--text-secondary`. */
  helperText?: string;
  /** Border color of the desktop header row, the Files sidebar divider, and the mobile sticky action bar. Defaults to `--stroke-tertiary`. */
  border?: string;
}

/** Typography class overrides for `SkillEditor`. */
export interface SkillEditorTypography {
  /** Typography class applied to the "Files" and selected-file section headings. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** Typography class applied to the hand-rendered Instructions field label. Defaults to `'dial-tiny-semi-text'`. */
  helperTextClassName?: string;
}

/** Grouped style overrides for `SkillEditor`. */
export interface SkillEditorStyles {
  /** Color overrides, applied as CSS custom properties. */
  colors?: SkillEditorColors;
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
  /**
   * A save-time conflict (e.g. a stale ETag), distinct from `submitError`.
   * When present, renders `conflict.message` plus a "Reload latest" control
   * calling `onReloadLatest`. Omit when there is no conflict.
   */
  conflict?: SkillEditorConflict;
  /** Called when the conflict state's "Reload latest" control is activated. Required when `conflict` can be set. */
  onReloadLatest?: () => void;
  /**
   * When `true`, the Name field renders read-only — its value is still
   * included in submitted values unchanged. The host sets this in edit mode,
   * since DIAL Core has no rename/move operation for a skill; the library
   * itself has no notion of "edit mode" and infers no policy from this flag
   * beyond disabling the field.
   */
  isNameReadOnly?: boolean;
  /**
   * Called whenever any field value or the file-tree state diverges from its
   * most recently seeded `initialValues`/`files` (`true`), and again once it
   * returns to exactly that seeded state (`false`).
   */
  onDirtyChange?: (isDirty: boolean) => void;
  /** File-tree mutation operations. */
  fileActions: SkillEditorFileActions;
  /**
   * Host-rendered content (e.g. a back button and page title) placed at the
   * start of the desktop header row, before the Cancel/Create actions. The
   * library renders it verbatim with no knowledge of what it contains.
   */
  headerContent?: ReactNode;
  /**
   * Host-rendered content shown in the main pane in place of `labels.supportingFileNote`
   * whenever the currently selected node is a supporting file (not `SKILL.md`, not a
   * folder). The library renders it verbatim with no knowledge of what it contains — it
   * only decides *when* to show it, mirroring the `headerContent` pattern. Falls back to
   * `labels.supportingFileNote` when omitted.
   */
  supportingFileContent?: ReactNode;
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
