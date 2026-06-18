export const getUtf8ByteLength = (str: string): number =>
  new TextEncoder().encode(str).byteLength;

export const safeDecodeURI = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};
