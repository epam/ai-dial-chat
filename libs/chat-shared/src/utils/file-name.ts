/** Returns the lower-cased extension of `filename`, including the leading dot (e.g. `'.pdf'`).
 *
 * Returns `''` if the name has no dot or starts with one (dotfile). */
export const getFileNameExtension = (filename: string): string => {
  const index = filename.lastIndexOf('.');
  return index > 0 ? filename.slice(index).toLowerCase() : '';
};

/** Returns the base portion of `filename` with its extension stripped.
 *
 * Returns the original string when there is no extension or the name starts with a dot. */
export const getFileNameWithoutExtension = (filename: string): string => {
  const index = filename.lastIndexOf('.');
  return index > 0 ? filename.slice(0, index) : filename;
};
