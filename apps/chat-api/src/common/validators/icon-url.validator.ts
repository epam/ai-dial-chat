import { registerDecorator, type ValidationOptions } from 'class-validator';
import { safeDecodeURIComponent } from '../utils/uri';

const HTTPS_URL_PATTERN = /^https?:\/\/[^\s]+$/;
const DIAL_FILE_ID_PREFIX = 'files/';

/*
 * DIAL_FILE_ID_PREFIX-relative paths legitimately need `/` for nested
 * folders, so traversal is rejected at the segment level (see
 * safe-toolset-name.validator.ts for the same approach and its rationale).
 * Decoding each segment once more prevents a double-encoded slash from
 * hiding a traversal segment from the check.
 */
const getDecodedSegments = (value: string): string[] =>
  value
    .split('/')
    .flatMap((segment) => safeDecodeURIComponent(segment).split('/'));

const hasTraversalSegment = (value: string): boolean =>
  getDecodedSegments(value).some(
    (segment) => segment === '' || segment === '.' || segment === '..',
  );

/**
 * An icon/avatar reference: either an absolute `http(s)://` URL, or a DIAL
 * file id (`files/{bucket}/{path}`) pointing at a file picked through the
 * file manager. Rejects whitespace, control characters, and path-traversal
 * segments in the DIAL file id form.
 */
export const isIconUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (HTTPS_URL_PATTERN.test(value)) return true;
  if (!value.startsWith(DIAL_FILE_ID_PREFIX)) return false;
  if (/[\s\p{Cc}]/u.test(value)) return false;
  return !hasTraversalSegment(value);
};

export const IsIconUrl = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isIconUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isIconUrl,
        defaultMessage() {
          return (
            'Must be a valid https?:// URL or a DIAL file id ' +
            '(files/{bucket}/{path}) with no empty, dot, or dot-dot path ' +
            'segments'
          );
        },
      },
    });
  };
};
