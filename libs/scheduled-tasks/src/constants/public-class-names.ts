/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the task cards through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes — a card's `aria-label` is the task's
 * display name, so it was never a selector. They carry no declarations of
 * their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const SCHEDULED_TASKS_CLASS = {
  /**
   * One task card, additive to the `dial-kit-card-shell` that
   * `@epam/ai-dial-ui-kit` draws.
   */
  card: 'dial-scheduled-tasks-card',
  /** The responsive grid the cards are laid out in. */
  cardGrid: 'dial-scheduled-tasks-card-grid',
  /** Refine and Undo buttons. */
  refineAction: 'dial-scheduled-tasks-refine-action',
  /** Field-local refinement feedback. */
  refineFeedback: 'dial-scheduled-tasks-refine-feedback',
} as const;
