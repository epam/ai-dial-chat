const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/**
 * Returns the plain-text folder segments of a personal resource id
 * `{type}/{bucket}/{folder…}/{name}`, e.g. `['Design', 'Audit']` for
 * `applications/b1/Design/Audit/agent__1.0.0`; `[]` at the bucket root or
 * for an id that is not a full resource id.
 */
export const parseResourceFolderPath = (resourceId: string): string[] => {
  const segments = resourceId.split('/');
  // `{type}`, `{bucket}` and the item name surround the folders.
  if (segments.length <= 3) return [];
  return segments.slice(2, -1).map(decodeSegment);
};
