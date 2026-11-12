/**
 * Admits `PUBLICATION_FILTER_SOURCES`: an unset or empty list resolves to
 * `undefined`, so the registry default (the legacy source list) applies.
 */
export const admitPublicationFilterSources = (
  sources: readonly string[] | undefined,
): string[] | undefined => {
  if (!sources?.length) {
    return undefined;
  }
  return [...sources];
};
