import { registerDecorator, type ValidationOptions } from 'class-validator';
import { MARKER_NAME } from '../files.constants';

/**
 * Rejects a name equal to the reserved folder marker. A resource created or
 * renamed to this name would be indistinguishable from the empty-folder
 * marker and would disappear from listings.
 */
export const IsNotReservedMarkerName = (
  validationOptions?: ValidationOptions,
): PropertyDecorator => {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isNotReservedMarkerName',
      target: (object as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return value !== MARKER_NAME;
        },
        defaultMessage() {
          return `name must not be the reserved marker name "${MARKER_NAME}"`;
        },
      },
    });
  };
};

const getLastPathSegment = (value: string): string => {
  const withoutTrailingSlashes = value.replace(/\/+$/, '');
  const lastSlashIndex = withoutTrailingSlashes.lastIndexOf('/');
  return lastSlashIndex === -1
    ? withoutTrailingSlashes
    : withoutTrailingSlashes.slice(lastSlashIndex + 1);
};

/**
 * Rejects a destination path whose last segment is the reserved folder
 * marker, so a rename/move/copy cannot turn a user resource into a marker.
 * Marker children of a folder being renamed or copied are relocated inside
 * the service's fan-out and never travel through a request DTO, so they are
 * unaffected.
 */
export const IsNotReservedMarkerPath = (
  validationOptions?: ValidationOptions,
): PropertyDecorator => {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isNotReservedMarkerPath',
      target: (object as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          return getLastPathSegment(value) !== MARKER_NAME;
        },
        defaultMessage() {
          return `destinationPath must not end with the reserved marker name "${MARKER_NAME}"`;
        },
      },
    });
  };
};
