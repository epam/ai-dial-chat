import { encodeDialResourcePath } from './encode-dial-path';

export const APPLICATION_RESOURCE_PREFIX = 'applications/';

export interface DialApplicationResource {
  bucket: string;
  path: string;
}

/**
 * Splits a full DIAL application resource id (`applications/{bucket}/{path}`)
 * into the `bucket`/`path` pair the Core SDK's application operations take.
 * Returns `undefined` for a bare deployment name, which is not a resource id.
 */
export const parseDialApplicationResource = (
  applicationName: string,
): DialApplicationResource | undefined => {
  if (!applicationName.startsWith(APPLICATION_RESOURCE_PREFIX)) {
    return undefined;
  }

  const resource = applicationName.slice(APPLICATION_RESOURCE_PREFIX.length);
  const [bucket, ...pathSegments] = resource.split('/');
  const path = pathSegments.join('/');
  if (!bucket || !path) {
    return undefined;
  }

  return { bucket, path: encodeDialResourcePath(path) };
};
