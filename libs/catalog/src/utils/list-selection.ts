/**
 * Returns a new selection with `id` toggled. A newly selected id is appended,
 * so the set's iteration order stays the order items were selected in.
 */
export const toggleSelectedId = (
  selectedIds: ReadonlySet<string>,
  id: string,
): Set<string> => {
  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
};

/**
 * Returns a new selection after a select-all over `listedIds`: when every
 * listed id is already selected they are all removed, otherwise the missing
 * ones are appended in list order. Selected ids that are not listed (e.g.
 * filtered out by the host) are kept either way.
 */
export const toggleAllSelectedIds = (
  selectedIds: ReadonlySet<string>,
  listedIds: readonly string[],
): Set<string> => {
  const next = new Set(selectedIds);
  const isEveryListedSelected =
    listedIds.length > 0 && listedIds.every((id) => selectedIds.has(id));

  listedIds.forEach((id) => {
    if (isEveryListedSelected) {
      next.delete(id);
    } else {
      next.add(id);
    }
  });
  return next;
};
