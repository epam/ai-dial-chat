/** Returns a path's final segment (its display name in the file tree). */
export const nameFromPath = (path: string): string => {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? path : path.slice(lastSlash + 1);
};

/** Wraps raw bytes in a `Blob`, copying them so the source buffer can be reused. */
export const toBlob = (bytes: Uint8Array): Blob =>
  new Blob([new Uint8Array(bytes)]);
