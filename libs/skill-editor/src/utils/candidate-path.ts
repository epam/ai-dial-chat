/**
 * Resolves a selected/dropped `File`'s relative path: `webkitRelativePath`
 * when the browser populated it, falling back to `File.name`, with any
 * backslash separator normalized to a forward slash.
 */
export const resolveCandidatePath = (file: File): string => {
  const raw =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name;
  return raw.replace(/\\/g, '/');
};
