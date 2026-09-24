/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts target the composer through these instead of hashed CSS-module locals,
 * DOM order, or ARIA attributes. They carry no declarations of their own; they
 * exist only as stable selectors. Renaming one or moving it to a different
 * element is a breaking change.
 */
export const CONVERSATION_INPUT_CLASS = {
  /** The composer's outer bordered container. */
  wrapper: 'dial-ci-wrapper',
  /** The wrapper around the add-attachment button. */
  addCluster: 'dial-ci-add-cluster',
  /** The model selector trigger button, in every presentation. */
  modelSelectorButton: 'dial-ci-model-selector-button',
} as const;
