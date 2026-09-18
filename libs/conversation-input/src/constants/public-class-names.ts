/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the composer and the model menu through these instead of hashed
 * CSS-module locals, DOM order, or ARIA attributes. They carry no declarations
 * of their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const CONVERSATION_INPUT_CLASS = {
  /** The composer's outer bordered container. */
  wrapper: 'dial-ci-wrapper',
  /** The row holding the textarea, add button, tool chips, and footer actions. */
  actionRow: 'dial-ci-action-row',
  /** The wrapper around the textarea area inside the action row. */
  textareaWrap: 'dial-ci-textarea-wrap',
  /** The wrapper around the add-attachment button. */
  addCluster: 'dial-ci-add-cluster',
  /** The trailing cluster: model selector, mic, and send/stop buttons. */
  footerActions: 'dial-ci-footer-actions',
  /** The model selector trigger button, in every presentation. */
  modelSelectorButton: 'dial-ci-model-selector-button',
  /**
   * The model menu root. Present on all three presentations: the desktop
   * dropdown, the host-supplied `modelPickerOverlay` dropdown, and the mobile
   * bottom sheet.
   */
  modelMenu: 'dial-ci-model-menu',
  /** The sticky search header inside the model menu. */
  modelMenuSearch: 'dial-ci-model-menu-search',
  /** Every deployment row in the model menu. */
  modelMenuItem: 'dial-ci-model-menu-item',
  /**
   * The currently selected deployment row, additive to `modelMenuItem`. The
   * check mark itself is drawn by `@epam/ai-dial-ui-kit` and has no class here.
   */
  modelMenuItemSelected: 'dial-ci-model-menu-item-selected',
} as const;
