/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the inline MCP app preview through these instead of hashed
 * CSS-module locals, DOM order, or ARIA attributes. They carry no declarations
 * of their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const MCP_APPS_CLASS = {
  /** The preview's bordered outer card. */
  preview: 'dial-mcp-apps-preview',
  /**
   * The header strip above the mounted app, holding the reload and
   * expand-to-canvas actions. It sits outside the app's own content, so a host
   * restyling it never overlaps what the app draws.
   */
  previewHeader: 'dial-mcp-apps-preview-header',
} as const;
