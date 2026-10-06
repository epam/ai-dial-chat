import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { safeDecodeURIComponent } from '../utils/uri';
import { DEPLOYMENT_ID_PATTERN } from './deployment-id.pattern';

/*
 * DEPLOYMENT_ID_PATTERN's character class permits `.` and `/`, so a
 * traversal payload like `../etc/passwd` (decoded from `..%2Fetc%2Fpasswd`)
 * or `applications/b/../x` passes it — see GitHub #7925. Resource ids
 * legitimately need `/` for full `{type}/{bucket}/{path}` resource URLs, so
 * this adds a segment-level check instead of dropping `/` from the
 * allowlist. Decoding each segment once more prevents a percent-encoded dot
 * (`%2e%2e`) or a double-encoded slash from hiding a traversal segment from
 * that check. Dots inside a segment (`a.b`, `__1.0.0__`) stay valid.
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
 * Returns `true` when `value` is a non-empty string matching
 * `DEPLOYMENT_ID_PATTERN` with no empty, `.`, or `..` path segment, raw or
 * percent-encoded.
 */
export const isSafeResourceId = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) return false;

  return DEPLOYMENT_ID_PATTERN.test(value) && !hasTraversalSegment(value);
};

export const SAFE_RESOURCE_ID_VALIDATION_MESSAGE =
  'must contain only supported characters or valid percent-encoded bytes, ' +
  'and must not contain empty, dot, or dot-dot path segments, including when encoded';

/** class-validator decorator for {@link isSafeResourceId}. */
export const IsSafeResourceId = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isSafeResourceId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isSafeResourceId,
        defaultMessage(args?: ValidationArguments) {
          return `${args?.property ?? propertyName} ${SAFE_RESOURCE_ID_VALIDATION_MESSAGE}`;
        },
      },
    });
  };
};
