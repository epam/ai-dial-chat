/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the prompt editor through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. These classes carry no declarations of
 * their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const PROMPT_EDITOR_CLASS = {
  /** The editor's scrolling form column, inside the shared editor layout. */
  form: 'dial-prompt-editor-form',
  /** The folder picker row rendered by `PromptFolderField`. */
  folderField: 'dial-prompt-editor-folder-field',
} as const;
