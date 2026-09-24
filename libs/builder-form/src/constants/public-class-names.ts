/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the editor shell through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes. They carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const BUILDER_FORM_CLASS = {
  /** The editor layout root, which holds the header and the content columns. */
  layout: 'dial-builder-form-layout',
  /** Every `EditorSection` box, whatever a caller puts inside it. */
  section: 'dial-builder-form-section',
  /** The Metadata section `EntityEditor` renders in the left column. */
  metadataSection: 'dial-builder-form-metadata-section',
  /** The Setup section `EntityEditor` renders in the right column. */
  setupSection: 'dial-builder-form-setup-section',
} as const;
