/*
 * The design gives a select list one maximum length — 344px of options — and
 * scrolls past it. The ui kit's own `Select` applies this to its option box,
 * but does not export the value, so every hand-built select-list panel (the
 * deployment picker, the favorite-prompts panel, the catalog topic filter)
 * would otherwise carry its own cap and drift from the kit's list.
 *
 * The cap belongs to the scroll box holding the options only — a header, a
 * search row or a footer sits outside it and must not eat into the 344px.
 */
export const SELECT_LIST_MAX_HEIGHT_PX = 344;

/** Tailwind form of {@link SELECT_LIST_MAX_HEIGHT_PX}, for the options scroll box. */
export const SELECT_LIST_MAX_HEIGHT_CLASS_NAME = 'max-h-[344px]';
