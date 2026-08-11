import { registerDecorator, type ValidationOptions } from 'class-validator';
import { DEPLOYMENT_ID_PATTERN } from './deployment-id.pattern';

/*
 * DEPLOYMENT_ID_PATTERN's character class permits `.` and `/`, so a
 * traversal payload like `../etc/passwd` (decoded from `..%2Fetc%2Fpasswd`)
 * passes it — see GitHub #7925. Toolset names legitimately need `/` for
 * custom toolset paths (`toolsets/{bucket}/{path}`, see
 * ToolsetsService.parseDialToolsetResource), so the fix adds a
 * segment-level check instead of dropping `/` from the allowlist.
 */
const hasTraversalSegment = (value: string): boolean =>
  value
    .split('/')
    .some((segment) => segment === '' || segment === '.' || segment === '..');

export const isSafeToolsetName = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) return false;

  return DEPLOYMENT_ID_PATTERN.test(value) && !hasTraversalSegment(value);
};

export const IsSafeToolsetName = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isSafeToolsetName',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isSafeToolsetName,
        defaultMessage() {
          return (
            'Toolset name must contain only supported characters or valid ' +
            'percent-encoded bytes, and must not contain empty, dot, or ' +
            'dot-dot path segments'
          );
        },
      },
    });
  };
};
