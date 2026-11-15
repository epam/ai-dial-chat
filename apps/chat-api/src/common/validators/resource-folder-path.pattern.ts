/**
 * A plain-text folder path inside one bucket: empty (the bucket root) or
 * non-empty `/`-separated segments, with no leading, trailing or doubled `/`.
 * Pair it with `IsValidFilePath`, which rejects `..`, forbidden characters
 * and encoded separators.
 */
export const RESOURCE_FOLDER_PATH_PATTERN = /^(?:[^/]+(?:\/[^/]+)*)?$/;

export const RESOURCE_FOLDER_PATH_VALIDATION_MESSAGE =
  'folderPath must be empty or slash-separated folder names without leading, trailing or doubled slashes';
