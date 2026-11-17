import {
  getBaseMimeType,
  inferMimeTypeFromPath,
} from '@epam/ai-dial-chat-shared';

/* The generic type a browser reports when the OS has no mapping for the extension. */
const GENERIC_BINARY_MIME_TYPE = 'application/octet-stream';

/** Returns `true` when `mimeType` names no concrete format — empty or `application/octet-stream`. */
const isUnknownMimeType = (mimeType: string): boolean => {
  const baseMimeType = getBaseMimeType(mimeType);
  return baseMimeType === '' || baseMimeType === GENERIC_BINARY_MIME_TYPE;
};

/*
 * Firefox takes `File.type` from the OS registry, so on Windows a `.md` file
 * (and other extensions Windows does not register) arrives with an empty type
 * or `application/octet-stream`, while Chromium uses its own built-in table.
 * Returns the file unchanged when the browser already reported a concrete
 * type or the extension is not recognized; otherwise returns a copy whose
 * `type` is inferred from the name, so validation, the tile icon and the
 * upload's content type all see the same format.
 */
export const withResolvedFileType = (file: File): File => {
  if (!isUnknownMimeType(file.type)) return file;
  const inferredType = inferMimeTypeFromPath(file.name);
  if (inferredType == null) return file;
  return new File([file], file.name, {
    type: inferredType,
    lastModified: file.lastModified,
  });
};
