import { fileMetadataMatchesPath } from './file-metadata-match';
import { MARKER_NAME } from './files.constants';

/** True only when DIAL returned metadata for this exact marker object. */
export const markerMetadataMatches = (
  data: unknown,
  bucket: string,
  markerPath: string,
): boolean => {
  if (data == null || typeof data !== 'object') return false;
  if ((data as { name?: string }).name !== MARKER_NAME) return false;

  return fileMetadataMatchesPath(data, bucket, markerPath);
};
