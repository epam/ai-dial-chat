/**
 * Merges the selection the ui-kit `Grid` reports into the host's selection.
 *
 * The grid only knows the rows it holds and reports them in row order, so a
 * plain copy would lose two things the host relies on: the order items were
 * selected in, and selected ids the host filtered out of the list. Previous ids
 * are kept in their order when they are unlisted or still selected; ids the
 * grid newly selected are appended after them, in the grid's order.
 */
export const mergeGridSelection = (
  previous: ReadonlySet<string>,
  gridIds: ReadonlySet<string>,
  listedIds: readonly string[],
): Set<string> => {
  const listed = new Set(listedIds);
  const next = new Set<string>();

  previous.forEach((id) => {
    if (!listed.has(id) || gridIds.has(id)) next.add(id);
  });
  gridIds.forEach((id) => next.add(id));

  return next;
};

/** Returns the ids a picker commits: attached ids still checked or not listed, in order, then newly checked ids. */
export const applyCatalogSelection = (
  attachedIds: readonly string[],
  checkedIds: ReadonlySet<string>,
  listedIds: ReadonlySet<string>,
): string[] => {
  const attached = new Set(attachedIds);
  // An attached id the picker does not list had no row to uncheck, so it stays.
  const kept = attachedIds.filter(
    (id) => checkedIds.has(id) || !listedIds.has(id),
  );
  const added = [...checkedIds].filter((id) => !attached.has(id));
  return [...kept, ...added];
};
