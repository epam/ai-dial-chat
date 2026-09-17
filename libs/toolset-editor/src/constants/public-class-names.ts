/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the toolset editor through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. They carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const TOOLSET_EDITOR_CLASS = {
  /** The metadata column of the editor, inside the shared editor layout. */
  metadataSection: 'dial-toolset-editor-metadata-section',
  /** The setup column beside it, holding the connection and auth forms. */
  setupSection: 'dial-toolset-editor-setup-section',
} as const;
