import { registerDecorator, type ValidationOptions } from 'class-validator';
import { safeDecodeURIComponent } from '../utils/uri';

const hasAsciiControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });

const getDecodedSegments = (value: string): string[] =>
  value
    .split('/')
    .flatMap((segment) => safeDecodeURIComponent(segment).split('/'));

export const isSafeDeploymentId = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) return false;

  return getDecodedSegments(value).every(
    (segment) =>
      segment.length > 0 &&
      segment !== '.' &&
      segment !== '..' &&
      !hasAsciiControlCharacter(segment),
  );
};

export const IsSafeDeploymentId = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isSafeDeploymentId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isSafeDeploymentId,
        defaultMessage() {
          return 'deployment must not contain empty, dot, dot-dot, or control-character path segments';
        },
      },
    });
  };
};
